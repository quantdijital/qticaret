import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { COD_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { PAYMENT_LINKS } from "../../modules/platform-settings/features"
import {
  linkCartProblem,
  linkCodProblem,
  linkIdOfCart,
} from "../../workflows/payment-links/cart-guard"
import {
  AdminExtendPaymentLink,
  AdminGetPaymentLinks,
  AdminPaymentLinkAction,
  AdminPostPaymentLink,
  AdminPreviewPaymentLink,
  AdminResendPaymentLink,
} from "../admin/payment-links/validators"
import { StorePostPaymentLinkCart } from "../store/payment-links/[token]/cart/validators"
import { requireUserActor } from "./actor"
import { auditSensitiveRead } from "./audit"
import { rateLimit } from "./rate-limit"
import { requireReauth } from "./reauth"
import { requireFeature } from "./require-feature"
import { requestPath } from "./request-path"
import { refuseSuspendedCartWrite } from "./plan-guard"

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => unknown

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** A link page and its button, per address (adr/0051 §3). */
const PAY_LINK: RateLimitProfile = { name: "pay_link", perIp: { max: 30, windowMs: 15 * MINUTE } }
/** Links a staff member makes: sixty an hour (adr/0051 §8). */
const LINK_CREATE: RateLimitProfile = {
  name: "payment_link_create",
  perIdentityAnyIp: { max: 60, windowMs: HOUR },
}
/** The form's summary, worked out as staff type. */
const LINK_PREVIEW: RateLimitProfile = {
  name: "payment_link_preview",
  perIdentityAnyIp: { max: 600, windowMs: HOUR },
}

const staffOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id
const perStaff = (profile: RateLimitProfile) => rateLimit(() => profile, { identity: staffOf })

/** Behind `orders.payment_links` (first: a shop without it sees no route), for people only. */
const staff = (...middlewares: Middleware[]): Middleware[] => [
  requireFeature(PAYMENT_LINKS),
  requireUserActor,
  ...middlewares,
]

async function cartMetadata(req: MedusaRequest): Promise<unknown> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["metadata"],
    filters: { id: req.params["id"] ?? "" },
  })
  return (data[0] as { metadata?: unknown } | undefined)?.metadata
}

// A cart's lines and codes; the cart itself only where its codes or region change
const LOCKED_PATH = /^\/store\/carts\/[^/]+\/(?:line-items|promotions)(?:\/|$)/i
// A gift line's recipient is the customer's to give (adr/0025 Ek 2026-11-03)
const GIFT_PATH = /^\/store\/carts\/[^/]+\/line-items\/[^/]+\/gift\/?$/i
const CART_PATH = /^\/store\/carts\/[^/]+\/?$/i
const CART_LOCKED_FIELDS = ["promo_codes", "region_id", "sales_channel_id"]

/**
 * A cart opened from a link keeps the link's lines and code (adr/0051 §4):
 * no line added, removed or changed, no code added or taken off, no other
 * region. Address, shipping, invoice details and the way to pay stay the
 * customer's. The completion hook checks it all again.
 */
async function lockLinkCart(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const path = requestPath(req)
  const body = (req.body ?? {}) as Record<string, unknown>
  const writes =
    (req.method === "POST" || req.method === "DELETE") &&
    ((LOCKED_PATH.test(path) && !GIFT_PATH.test(path)) ||
      (CART_PATH.test(path) && CART_LOCKED_FIELDS.some((key) => key in body)))
  if (!writes) {
    next()
    return
  }
  try {
    const locked = linkIdOfCart(await cartMetadata(req)) !== null
    next(locked ? new ValidationError("cart.payment_link_locked") : undefined)
  } catch (error) {
    next(error)
  }
}

/**
 * Starting a payment for a cart (adr/0051 §4, §5): a link's cart while the
 * link is open, its latest, as made; a link's code on no other cart. Cash
 * on delivery for a link's order only when the owner allows it (soru 4).
 */
async function guardLinkPaymentStart(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const cartId = req.params["id"] ?? ""
    const problem = await linkCartProblem(req.scope, cartId, "start")
    if (problem) {
      next(new ValidationError(problem))
      return
    }
    const provider = (req.body as { provider_id?: unknown } | undefined)?.provider_id
    const cod =
      provider === COD_PAYMENT_PROVIDER_ID
        ? await linkCodProblem(req.scope, await cartMetadata(req))
        : null
    next(cod ? new ValidationError(cod, { field: "provider_id" }) : undefined)
  } catch (error) {
    next(error)
  }
}

/**
 * Medusa's draft orders are a second way to an order past consent, fraud
 * checks and invoicing (adr/0051 §9): their writes are closed for
 * everyone, as Medusa's order edits are (adr/0033 §7).
 */
function refuseCoreDraftOrders(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "GET" ? undefined : new ValidationError("orders.use_payment_link"))
}

const action = (path: string, ...middlewares: Middleware[]) => ({
  matcher: `/admin/payment-links/:id/${path}`,
  methods: ["POST" as const],
  middlewares: staff(...middlewares),
})

/** adr/0051: staff-made orders paid through a link. */
export const PAYMENT_LINK_ROUTES = [
  {
    matcher: "/admin/payment-links",
    methods: ["GET" as const],
    middlewares: staff(
      validateAndTransformQuery(AdminGetPaymentLinks, {}),
      auditSensitiveRead("payment_link", { list: true })
    ),
  },
  {
    matcher: "/admin/payment-links",
    methods: ["POST" as const],
    middlewares: staff(
      perStaff(LINK_CREATE),
      validateAndTransformBody(AdminPostPaymentLink),
      requireReauth()
    ),
  },
  {
    matcher: "/admin/payment-links/preview",
    methods: ["POST" as const],
    middlewares: staff(perStaff(LINK_PREVIEW), validateAndTransformBody(AdminPreviewPaymentLink)),
  },
  {
    matcher: "/admin/payment-links/:id",
    methods: ["GET" as const],
    middlewares: staff(auditSensitiveRead("payment_link")),
  },
  {
    matcher: "/admin/payment-links/:id/share",
    methods: ["GET" as const],
    middlewares: staff(auditSensitiveRead("payment_link")),
  },
  action("cancel", validateAndTransformBody(AdminPaymentLinkAction)),
  action("extend", validateAndTransformBody(AdminExtendPaymentLink)),
  action("resend", perStaff(LINK_CREATE), validateAndTransformBody(AdminResendPaymentLink)),
  {
    matcher: "/store/payment-links/:token",
    methods: ["GET" as const],
    middlewares: [requireFeature(PAYMENT_LINKS), rateLimit(() => PAY_LINK)],
  },
  {
    matcher: "/store/payment-links/:token/cart",
    methods: ["POST" as const],
    middlewares: [
      // adr/0061 §5.5: a suspended shop opens no cart, a link's either
      refuseSuspendedCartWrite,
      requireFeature(PAYMENT_LINKS),
      rateLimit(() => PAY_LINK),
      validateAndTransformBody(StorePostPaymentLinkCart),
    ],
  },
  // The link's cart: its lines and code locked, its payment started only while the link stands
  // No `methods`: mounted for the cart and every path below it (its lines, its codes)
  { matcher: "/store/carts/:id", middlewares: [lockLinkCart] },
  {
    matcher: "/store/carts/:id/payment-session",
    methods: ["POST" as const],
    middlewares: [guardLinkPaymentStart],
  },
  ...["/admin/draft-orders", "/admin/draft-orders/*"].map((matcher) => ({
    matcher,
    middlewares: [refuseCoreDraftOrders],
  })),
]
