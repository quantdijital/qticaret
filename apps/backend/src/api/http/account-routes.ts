import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate, validateAndTransformBody } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { linkSocialIdentityWorkflow } from "../../workflows/account/link-social-identity"
import { attachGuestOrdersWorkflow } from "../../workflows/orders/attach-guest-orders"
import {
  StorePostCheckoutConsent,
  StorePostConsent,
} from "../store/customers/me/consents/validators"
import { StorePostMigrationClaim } from "../store/customers/me/migration-claim/validators"
import { StorePostWishlistItem } from "../store/customers/me/wishlist/validators"
import { StorePostOrderLookup } from "../store/order-lookup/validators"
import { StorePostStockAlert } from "../store/stock-alerts/validators"
import { requireMailDomain } from "./mail-domain"
import { notePasswordChange, tokenAfterPasswordChange } from "./password-change"
import { newPasswordPolicy } from "./password-policy"
import { verificationOfOwnIdentity } from "./verification"
import { claimWholesaleAccount } from "./wholesale-claim"
import { customerOnPost, guardCartTransfer } from "./cart-transfer-guard"
import { optionalCustomer, orderPageAccess } from "./order-access"
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
 * (adr/0037 §1). A first social sign-in joins the confirmed account of its
 * address instead, if there is one (§3). Runs after Medusa's
 * authentication and body validation.
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
    const identities = identity.provider_identities ?? []
    const email = loginEmailOf(identities)
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
    // A social sign-in whose address already has a confirmed account joins it (adr/0037 §3)
    if (!identities.some((each) => each.provider === "emailpass")) {
      const { result: linked } = await linkSocialIdentityWorkflow(req.scope).run({
        input: {
          auth_identity_id: identity.id,
          app_metadata: identity.app_metadata ?? null,
          email,
        },
      })
      if (linked) {
        res.json({ customer: linked })
        return
      }
    }
    body["email"] = email
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * A signed-in customer reading their account or orders takes in the
 * orders they placed as a guest with the same address (adr/0037 §1), once
 * they have proven the address (`provenCustomer`; a session alone is not
 * proof): the first read after the confirmation takes them. A failure
 * only leaves them where they were. No `methods` on its routes (Medusa's
 * own): the method is checked here.
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
 * Medusa's order transfer answers any signed-in customer with the whole
 * order, addresses and phone included, for its id alone (security review
 * 2026-10-29). A shopper's guest orders join their account through
 * `attachGuestOrders` instead; the transfer routes are not there.
 */
function hideOrderTransfer(_req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(new MedusaError(MedusaError.Types.NOT_FOUND, "Not found"))
}

/**
 * F10.1 (adr/0037): a customer account is opened for the identity's own
 * address; an order opens to its customer or the key from its e-mail.
 */
export const ACCOUNT_ROUTES = [
  // No `methods` on purpose: a method-scoped middleware may sort after the core route
  ...["/store/orders/:id/transfer", "/store/orders/:id/transfer/*"].map((matcher) => ({
    matcher,
    middlewares: [hideOrderTransfer],
  })),
  {
    matcher: "/store/customers",
    methods: ["POST" as const],
    middlewares: [registrationEmailFromIdentity],
  },
  { matcher: "/store/orders/:id", middlewares: [orderPageAccess] },
  // ADR-0068 slice 3 review M1: a cart moves to the signed-in customer only when it is open,
  // no payment link's, and nobody's, a guest's or theirs; else Medusa's transfer never runs
  { matcher: "/store/carts/:id/customer", middlewares: [customerOnPost, guardCartTransfer] },
  { matcher: "/store/orders", middlewares: [attachGuestOrders] },
  // ADR-0068 §3: an invited wholesaler's account taken on the same proof
  { matcher: "/store/customers/me", middlewares: [attachGuestOrders, claimWholesaleAccount] },
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
  // F14.5: a moved customer's record, taken with the invitation's key
  {
    matcher: "/store/customers/me/migration-claim",
    methods: ["POST" as const],
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      rateLimit(() => RATE_LIMIT_PROFILES.migration_claim),
      validateAndTransformBody(StorePostMigrationClaim),
    ],
  },
  // F10.4: the signed-in customer's saved products
  {
    matcher: "/store/customers/me/wishlist",
    methods: ["GET" as const],
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    matcher: "/store/customers/me/wishlist",
    methods: ["POST" as const],
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(StorePostWishlistItem),
    ],
  },
  {
    matcher: "/store/customers/me/wishlist/:id",
    methods: ["DELETE" as const],
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    matcher: "/store/carts/:id/consents",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(StorePostCheckoutConsent)],
  },
  // F10.5: a stock alert, signed in or a guest; counted per address too
  {
    matcher: "/store/stock-alerts",
    methods: ["POST" as const],
    middlewares: [
      optionalCustomer,
      rateLimit(() => RATE_LIMIT_PROFILES.stock_alert, {
        identity: (req) => {
          const email = (req.body as { email?: unknown } | undefined)?.email
          return typeof email === "string" ? email.trim().toLowerCase() : undefined
        },
      }),
      validateAndTransformBody(StorePostStockAlert),
      requireMailDomain(),
    ],
  },
  // F10 M9: an address whose domain takes no mail opens no account; no
  // `methods`, so it runs before Medusa's own route
  { matcher: "/auth/customer/emailpass/register", middlewares: [requireMailDomain()] },
  // F15.1: a new password keeps the rule (adr/0043), and a changed one ends
  // the tokens given before it. Registration's without `methods`, like the
  // mail domain's above: it runs before Medusa's own route
  { matcher: "/auth/:actor_type/emailpass/register", middlewares: [newPasswordPolicy] },
  {
    matcher: "/auth/:actor_type/emailpass/update",
    methods: ["POST" as const],
    middlewares: [newPasswordPolicy, notePasswordChange],
  },
  ...["/auth/token/refresh", "/auth/session", "/store/customers"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [tokenAfterPasswordChange],
  })),
  // F15.1: a code confirms an address only in the session of the identity that asked for it
  {
    matcher: "/auth/verification/confirm",
    methods: ["POST" as const],
    middlewares: [verificationOfOwnIdentity],
  },
  // The links in messages (unsubscribe, consent, stock alert): http/email-link-routes.ts
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
