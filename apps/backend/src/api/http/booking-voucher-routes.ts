import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import { requireUserActor } from "./actor"
import { optionalCustomer, orderAccess } from "./order-access"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

/** The typed code: in the body, so it stays out of URLs and access logs. */
export const AdminPostVoucherCheck = z.object({ code: z.string().min(1).max(64) }).strict()

/**
 * Booking vouchers (adr/0076 Ek D7b), behind `catalog.booking`. The
 * shopper's: their own order only (signed in or with the order's key,
 * adr/0037 §2; anyone else is told there is no such order). Staff's code
 * check: every role that reads orders (operations and read-only too, the
 * role table), a staff member's only, within its own budget so codes
 * cannot be tried in bulk; each check is recorded (the route).
 */
export const BOOKING_VOUCHER_ROUTES = [
  {
    matcher: "/store/orders/:id/voucher",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), optionalCustomer, orderAccess],
  },
  {
    matcher: "/admin/booking-vouchers/check",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.voucher_check, {
        identity: (req) => (req as AuthenticatedMedusaRequest).auth_context.actor_id,
      }),
      validateAndTransformBody(AdminPostVoucherCheck),
    ],
  },
]
