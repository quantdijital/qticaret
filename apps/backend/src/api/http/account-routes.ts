import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate, validateAndTransformBody } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { attachGuestOrdersWorkflow } from "../../workflows/orders/attach-guest-orders"
import {
  StorePostCheckoutConsent,
  StorePostConsent,
} from "../store/customers/me/consents/validators"
import { StorePostOrderLookup } from "../store/order-lookup/validators"
import { orderPageAccess } from "./order-access"
import { rateLimit } from "./rate-limit"
import { rejectRequest } from "./reject"

interface ProviderIdentity {
  provider: string
  entity_id: string
  user_metadata?: Record<string, unknown> | null
}

/**
 * The address an identity logs in with: its e-mail login's, else the one a
 * social provider vouched for (Google refuses an unverified one).
 */
export function loginEmailOf(identities: readonly ProviderIdentity[]): string | null {
  const own = identities.find((each) => each.provider === "emailpass")?.entity_id
  const vouched = identities
    .map((each) => each.user_metadata?.["email"])
    .find((value): value is string => typeof value === "string")
  const email = (own ?? vouched ?? "").trim().toLowerCase()
  return email === "" ? null : email
}

/**
 * `POST /store/customers` takes the e-mail from the registering identity,
 * whatever the body says: Medusa takes any address there (2.21.2), so a
 * registration token could open an account in a stranger's name
 * (adr/0037 §1). Runs after Medusa's authentication and body validation.
 */
export async function registrationEmailFromIdentity(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const authIdentityId = (req as Partial<AuthenticatedMedusaRequest>).auth_context
      ?.auth_identity_id
    const body = req.validatedBody as Record<string, unknown> | undefined
    if (!authIdentityId || !body) {
      // Medusa's own route refuses a request without a registration token
      next()
      return
    }
    const identity = await req.scope
      .resolve(Modules.AUTH)
      .retrieveAuthIdentity(authIdentityId, { relations: ["provider_identities"] })
    const email = loginEmailOf(identity.provider_identities ?? [])
    if (!email) {
      rejectRequest(
        req,
        res,
        400,
        { type: "invalid_data", message: "account.login_email_missing" },
        "login_email_missing"
      )
      return
    }
    body["email"] = email
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * A signed-in customer reading their account or orders takes in the
 * orders they placed as a guest with the same address (adr/0037 §1):
 * signing in proves the address. A failure only leaves them where they
 * were. No `methods` on its routes (Medusa's own): the method is checked here.
 */
export async function attachGuestOrders(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  if (req.method === "GET" && auth?.actor_type === "customer" && auth.actor_id) {
    await attachGuestOrdersWorkflow(req.scope)
      .run({ input: { customer_id: auth.actor_id } })
      .catch((error: unknown) => {
        logger.warn({ event: "orders.attach_guest_failed", err: errorSummary(error) })
      })
  }
  next()
}

/**
 * F10.1 (adr/0037): a customer account is opened for the identity's own
 * address; an order opens to its customer or the key from its e-mail.
 */
export const ACCOUNT_ROUTES = [
  {
    matcher: "/store/customers",
    methods: ["POST" as const],
    middlewares: [registrationEmailFromIdentity],
  },
  { matcher: "/store/orders/:id", middlewares: [orderPageAccess] },
  { matcher: "/store/orders", middlewares: [attachGuestOrders] },
  { matcher: "/store/customers/me", middlewares: [attachGuestOrders] },
  // adr/0038 §2: consent from the account and at checkout; the explicit
  // authenticate keeps the route closed whatever core's /me matchers do
  {
    matcher: "/store/customers/me/consents",
    methods: ["GET" as const],
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    matcher: "/store/customers/me/consents",
    methods: ["POST" as const],
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(StorePostConsent),
    ],
  },
  {
    matcher: "/store/carts/:id/consents",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(StorePostCheckoutConsent)],
  },
  // adr/0038 §1: an unsubscribe link, opened or one-clicked from anywhere
  {
    matcher: "/unsubscribe",
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  // Counted per address too: it mails one
  {
    matcher: "/store/order-lookup",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.order_lookup, {
        identity: (req) => {
          const email = (req.body as { email?: unknown } | undefined)?.email
          return typeof email === "string" ? email.trim().toLowerCase() : undefined
        },
      }),
      validateAndTransformBody(StorePostOrderLookup),
    ],
  },
]
