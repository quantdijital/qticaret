import type { MedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { AdminPostCodeBatchRevoke } from "../admin/promotions/[id]/code-batches/[campaign_id]/revoke/validators"
import { requireUserActor } from "./actor"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  cartRoute,
  normalizePromoCodes,
  normalizePromotionCode,
  oneCodePerCart,
  sentCodes,
} from "../validation/promotion-codes"
import { rateLimit } from "./rate-limit"
import { refuseWholesaleCodes } from "./wholesale-codes"

// Code tries counted per address and per cart (F4.6): only requests that send a code
function couponProfile(req: MedusaRequest) {
  const route = cartRoute(req)
  return route && route.mode !== "remove" && (sentCodes(req)?.length ?? 0) > 0
    ? RATE_LIMIT_PROFILES.coupon
    : null
}

const couponTries = rateLimit(couponProfile, {
  identity: (req) => cartRoute(req)?.cartId ?? undefined,
})

/**
 * F4.4/F4.6 (ADR-0024): promotion codes in one form wherever they are
 * saved or sent, one code per cart unless the shop combines them, and code
 * tries limited. Without `methods`, so they run before Medusa validates
 * the body (the code the route reads is the one they rewrote) and on every
 * path below the matcher; each picks its own routes (`cartRoute`).
 */
export const PROMOTION_ROUTES = [
  { matcher: "/admin/promotions", middlewares: [normalizePromotionCode] },
  // ADR-0068 §6: a wholesaler's cart takes no code, told before the one-code rule
  {
    matcher: "/store/carts",
    middlewares: [couponTries, normalizePromoCodes, refuseWholesaleCodes, oneCodePerCart],
  },
  // F4.6: the list without single-use code batches, a promotion's batches and their codes
  ...[
    "/admin/promotion-board",
    "/admin/promotions/:id/code-batches",
    "/admin/promotions/:id/code-batches/:campaign_id/codes",
  ].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  })),
  // F4.6: a batch's codes stopped
  {
    matcher: "/admin/promotions/:id/code-batches/:campaign_id/revoke",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCodeBatchRevoke)],
  },
]
