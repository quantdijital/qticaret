import { defineMiddlewares } from "@medusajs/framework/http"
import { CP_RATE_LIMIT_PROFILES } from "../lib/rate-limit-profiles"
import { rejectAmbiguousPath, requestBasics, routeAllowlist } from "./http/guards"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"

export default defineMiddlewares({
  routes: [
    // Global (no `methods`): these run before every core route middleware
    // and handler, so the allowlist answers 404 for Medusa's commerce routes
    // (adr/0061 §1.1). They run after Medusa's own global ones (body parser,
    // CORS)
    {
      matcher: "/*",
      middlewares: [requestBasics, rejectAmbiguousPath, routeAllowlist],
    },
    {
      matcher: "/auth/*",
      methods: ["POST"],
      middlewares: [rateLimit(authProfile, { identity: authIdentity })],
    },
    {
      matcher: "/admin/*",
      middlewares: [rateLimit(() => CP_RATE_LIMIT_PROFILES.admin_default)],
    },
    {
      matcher: "/tenant-api/*",
      middlewares: [rateLimit(() => CP_RATE_LIMIT_PROFILES.tenant_api)],
    },
  ],
})
