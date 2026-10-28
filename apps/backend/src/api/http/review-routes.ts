import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetReviews, AdminPostModerateReviews } from "../admin/product-reviews/validators"
import { StoreGetReviews, StorePostReview } from "../store/products/[id]/reviews/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * F10.6 (adr/0037 §4): reviews read by anyone, written by a signed-in
 * customer (whose address is confirmed: Medusa signs in no other) within
 * a budget, moderated by staff.
 */
export const REVIEW_ROUTES = [
  {
    matcher: "/store/products/:id/reviews",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetReviews, {})],
  },
  {
    matcher: "/store/products/:id/reviews",
    methods: ["POST" as const],
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      rateLimit(() => RATE_LIMIT_PROFILES.review_write, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(StorePostReview),
    ],
  },
  {
    matcher: "/admin/product-reviews",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetReviews, {})],
  },
  {
    matcher: "/admin/product-reviews/moderate",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostModerateReviews)],
  },
]
