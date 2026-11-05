import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetGoogleReviews,
  AdminPostGoogleMerchant,
  AdminPostGoogleReview,
  AdminPostGoogleReviewLocation,
  AdminPostSearchConsoleSite,
  GoogleCallbackQuery,
  StoreGetGoogleReviews,
} from "../admin/google/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * Calls to Google from the panel: a small budget per address and per staff
 * member, as the other providers' checks have (Merchant API's and URL
 * Inspection's quotas are the shop's; security review 2026-10-29).
 */
const googleCalls = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

/** F10 M13 (adr/0038 §5): the shop's Google account, connected and used by staff only. */
export const GOOGLE_ROUTES = [
  ...[
    "/admin/google",
    "/admin/google/connect",
    "/admin/seo/insights",
    "/admin/google/reviews",
    "/admin/google/reviews/connect",
  ].map((matcher) => ({
    matcher,
    middlewares: [requireUserActor],
  })),
  ...[
    "/admin/google/merchant/sync",
    "/admin/google/search-console/sites",
    "/admin/seo/insights/refresh",
    // adr/0058: Business Profile's quota is the platform's project's, shared by every shop
    "/admin/google/reviews/locations",
    "/admin/google/reviews/sync",
  ].map((matcher) => ({
    matcher,
    middlewares: [requireUserActor, googleCalls],
  })),
  {
    matcher: "/admin/google/reviews/location",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      googleCalls,
      validateAndTransformBody(AdminPostGoogleReviewLocation),
    ],
  },
  {
    matcher: "/admin/google/reviews/items",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetGoogleReviews, {})],
  },
  {
    matcher: "/admin/google/reviews/items/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostGoogleReview)],
  },
  // adr/0058: the storefront's Google reviews block, read by anyone
  {
    matcher: "/store/google-reviews",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetGoogleReviews, {})],
  },
  {
    matcher: "/admin/google/merchant",
    methods: ["POST" as const],
    middlewares: [requireUserActor, googleCalls, validateAndTransformBody(AdminPostGoogleMerchant)],
  },
  {
    matcher: "/admin/google/search-console",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostSearchConsoleSite)],
  },
  // Google's redirect back from its consent screen: a browser, not the panel
  {
    matcher: "/google/callback",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.webhook),
      // The staff member's own session: only who started the connection may finish it
      authenticate("user", ["session", "bearer"], { allowUnauthenticated: true }),
      validateAndTransformQuery(GoogleCallbackQuery, {}),
    ],
  },
]
