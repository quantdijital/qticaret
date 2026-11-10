import { defineMiddlewares } from "@medusajs/framework/http"
import { CP_RATE_LIMIT_PROFILES } from "../lib/rate-limit-profiles"
import { auditCpRequests } from "./http/audit"
import { CP_ROUTE_MIDDLEWARES } from "./http/cp-routes"
import { rejectAmbiguousPath, requestBasics, routeAllowlist } from "./http/guards"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"
import { noteSessionEnd, noteSessionStart } from "./http/sessions"
import { signInCodeOnce } from "./http/sign-in-code"
import { guardCpStaff } from "./http/staff-guard"

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
    // C4: a staff member's sessions are noted as they open and close, so
    // they can list and end them
    { matcher: "/auth/session", methods: ["POST"], middlewares: [noteSessionStart] },
    { matcher: "/auth/session", methods: ["DELETE"], middlewares: [noteSessionEnd] },
    // C4: a sign-in's app code, once, and never again for a step-up
    {
      matcher: "/auth/mfa/challenges/:id/verify",
      methods: ["POST"],
      middlewares: [signInCodeOnce],
    },
    {
      matcher: "/admin/*",
      middlewares: [rateLimit(() => CP_RATE_LIMIT_PROFILES.admin_default)],
    },
    // C4 (adr/0061 §3.5): every request recorded once answered (refusals
    // too), then the staff guard: the route table's row, 2FA, the step-up.
    // Global, so they run before each route's own validation and handler
    {
      matcher: "/admin/cp/*",
      middlewares: [auditCpRequests, guardCpStaff],
    },
    {
      matcher: "/tenant-api/*",
      middlewares: [rateLimit(() => CP_RATE_LIMIT_PROFILES.tenant_api)],
    },
    ...CP_ROUTE_MIDDLEWARES,
  ],
})
