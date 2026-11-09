import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import {
  AdminGetAbandonedCarts,
  AdminPostAbandonedCartRemind,
} from "../admin/abandoned-carts/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** Reminders a staff member sends by hand: each is a commercial e-mail in the shop's name. */
const REMIND: RateLimitProfile = {
  name: "abandoned_cart_remind",
  perIdentityAnyIp: { max: 30, windowMs: 60 * 60 * 1000 },
}

const perStaff = (profile: RateLimitProfile) =>
  rateLimit(() => profile, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  })

/** Müşteriler > Terk edilen sepetler (2026-11-06): people only; read-only staff not at all (roles). */
export const ABANDONED_CART_ROUTES = [
  {
    matcher: "/admin/abandoned-carts",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetAbandonedCarts, {})],
  },
  {
    matcher: "/admin/abandoned-carts/:id",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/abandoned-carts/:id/remind",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      perStaff(REMIND),
      validateAndTransformBody(AdminPostAbandonedCartRemind),
    ],
  },
]
