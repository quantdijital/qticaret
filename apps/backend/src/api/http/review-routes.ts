import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetQuestions,
  AdminModerateAnswers,
  AdminModerateQuestions,
  StoreGetQuestions,
  StorePostQaText,
} from "../admin/product-questions/validators"
import { AdminGetReviews, AdminPostModerateReviews } from "../admin/product-reviews/validators"
import { StoreGetReviews, StorePostReview } from "../store/products/[id]/reviews/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** A signed-in customer writing on the storefront, within one budget for reviews, questions and answers. */
const customerWrites = () => [
  authenticate("customer", ["session", "bearer"]),
  rateLimit(() => RATE_LIMIT_PROFILES.review_write, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  }),
]

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
    middlewares: [...customerWrites(), validateAndTransformBody(StorePostReview)],
  },
  // F10.10: questions read by anyone, asked and answered by signed-in customers
  {
    matcher: "/store/products/:id/questions",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetQuestions, {})],
  },
  {
    matcher: "/store/products/:id/questions",
    methods: ["POST" as const],
    middlewares: [...customerWrites(), validateAndTransformBody(StorePostQaText)],
  },
  {
    matcher: "/store/product-questions/:id/answers",
    methods: ["POST" as const],
    middlewares: [...customerWrites(), validateAndTransformBody(StorePostQaText)],
  },
  {
    matcher: "/admin/product-questions",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetQuestions, {})],
  },
  {
    matcher: "/admin/product-questions/moderate",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminModerateQuestions)],
  },
  {
    matcher: "/admin/product-questions/:id/answer",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(StorePostQaText)],
  },
  {
    matcher: "/admin/product-answers/moderate",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminModerateAnswers)],
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
