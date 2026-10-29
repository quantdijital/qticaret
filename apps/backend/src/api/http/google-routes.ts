import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminPostGoogleMerchant, GoogleCallbackQuery } from "../admin/google/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** F10 M13 (adr/0038 §5): the shop's Google account, connected and used by staff only. */
export const GOOGLE_ROUTES = [
  ...["/admin/google", "/admin/google/connect", "/admin/google/merchant/sync"].map((matcher) => ({
    matcher,
    middlewares: [requireUserActor],
  })),
  {
    matcher: "/admin/google/merchant",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostGoogleMerchant)],
  },
  // Google's redirect back from its consent screen: a browser, not the panel
  {
    matcher: "/google/callback",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.webhook),
      validateAndTransformQuery(GoogleCallbackQuery, {}),
    ],
  },
]
