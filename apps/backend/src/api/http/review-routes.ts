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
import {
  AdminGetReviews,
  AdminPostModerateReviews,
  AdminPostReviewReply,
} from "../admin/product-reviews/validators"
import {
  StoreGetReviewPhotos,
  StoreGetReviewSummary,
  StoreGetReviews,
  StoreGetShopReviews,
  StorePostReview,
  StorePostReviewPhotoQuery,
} from "../store/products/[id]/reviews/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** A signed-in customer writing on the storefront, within one budget for reviews, questions and answers. */
// Past three in an hour from one address, Turnstile first (turnstile-routes.ts)
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
  // F18 D10: every approved review, the shop's reviews page; one number of stars alone
  {
    matcher: "/store/reviews",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetShopReviews, {})],
  },
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
  // adr/0046 Ek 2026-11-04: the newest customer photos, for the home page
  {
    matcher: "/store/reviews/photos",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetReviewPhotos, {})],
  },
  // adr/0046 Ek 2026-11-05: the shop's average, count and stars' spread
  {
    matcher: "/store/reviews/summary",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetReviewSummary, {})],
  },
  // adr/0037 §4 Ek 2026-11-04: a review's photo, its bytes as the body (read by the route)
  {
    matcher: "/store/products/:id/reviews/photos",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      rateLimit(() => RATE_LIMIT_PROFILES.review_photo, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformQuery(StorePostReviewPhotoQuery, {}),
    ],
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
  // The shop's reply under a review, as a question's shop answer
  {
    matcher: "/admin/product-reviews/:id/reply",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReviewReply)],
  },
  {
    matcher: "/admin/product-reviews/:id/reply",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
]
