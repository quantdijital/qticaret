import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * F7 (adr/0031): a parcel's label, staff only (integration keys cannot
 * fetch it); Geliver's notifications, within the webhook budget.
 */
export const SHIPPING_ROUTES = [
  {
    matcher: "/hooks/geliver",
    methods: ["POST" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  {
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
