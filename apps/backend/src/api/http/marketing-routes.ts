import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostCartReminderRedeem } from "../store/cart-reminders/redeem/validators"
import { StorePostCartTracking } from "../store/carts/[id]/tracking/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** F10.7 (adr/0038 §1): a reminder's link back to the cart; its numbers for staff. */
export const MARKETING_ROUTES = [
  {
    matcher: "/store/cart-reminders/redeem",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.cart_return),
      validateAndTransformBody(StorePostCartReminderRedeem),
    ],
  },
  {
    matcher: "/admin/cart-reminders/summary",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // F10.9 (adr/0038 §4): the cookie banner's answer for the cart, within the checkout's budget
  {
    matcher: "/store/carts/:id/tracking",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostCartTracking),
    ],
  },
  // F10.8 (adr/0038 §3): feeds fetched by address alone; turned on and off by staff
  { matcher: "/feeds/*", middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.feed)] },
  ...[
    "/admin/marketing-feeds",
    "/admin/marketing-feeds/token",
    "/admin/marketing-feeds/generate",
  ].map((matcher) => ({ matcher, middlewares: [requireUserActor] })),
]
