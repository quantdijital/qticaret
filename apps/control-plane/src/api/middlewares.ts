import { defineMiddlewares } from "@medusajs/framework/http"
import { USAGE_REPORT_MAX_BYTES } from "@qticaret/types/control-plane"
import { CP_RATE_LIMIT_PROFILES } from "../lib/rate-limit-profiles"
import { auditAuth, auditCpRequests } from "./http/audit"
import { CP_ROUTE_MIDDLEWARES } from "./http/cp-routes"
import { csrfProtection } from "./http/csrf"
import { FLEET_ROUTE_MIDDLEWARES } from "./http/fleet-routes"
import { rejectAmbiguousPath, requestBasics, routeAllowlist } from "./http/guards"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"
import { gateRegistration } from "./http/register-gate"
import { noteSessionEnd, noteSessionStart } from "./http/sessions"
import { guardSecondStep, noteSignInChallenge } from "./http/sign-in-code"
import { guardCpStaff } from "./http/staff-guard"
import { guardTenantApi, tenantCallerOf } from "./http/tenant-api"
import { TENANT_ROUTE_MIDDLEWARES } from "./http/tenant-routes"
import { VAULT_ROUTE_MIDDLEWARES } from "./http/vault-routes"

export default defineMiddlewares({
  routes: [
    // Global (no `methods`): these run before every core route middleware
    // and handler, so the allowlist answers 404 for Medusa's commerce routes
    // (adr/0061 §1.1). They run after Medusa's own global ones (body parser,
    // CORS). C4 (L5): a cookie mutation from another origin is refused
    {
      matcher: "/*",
      middlewares: [requestBasics, rejectAmbiguousPath, routeAllowlist, csrfProtection],
    },
    {
      matcher: "/auth/*",
      methods: ["POST"],
      middlewares: [rateLimit(authProfile, { identity: authIdentity })],
    },
    // C4: staff sign-in, recorded (L6); a 2FA challenge noted to its login (M4)
    {
      matcher: "/auth/user/emailpass",
      methods: ["POST"],
      middlewares: [auditAuth("cp.auth.sign_in"), noteSignInChallenge],
    },
    // C4 (L1): a login only for an invitation's own address
    {
      matcher: "/auth/user/emailpass/register",
      methods: ["POST"],
      middlewares: [auditAuth("cp.auth.register"), gateRegistration],
    },
    // C4: a staff member's sessions are noted as they open and close; the
    // index is what makes one count
    {
      matcher: "/auth/session",
      methods: ["POST"],
      middlewares: [auditAuth("cp.auth.session_open"), noteSessionStart],
    },
    {
      matcher: "/auth/session",
      methods: ["DELETE"],
      middlewares: [auditAuth("cp.auth.sign_out"), noteSessionEnd],
    },
    // C4: a sign-in's 2FA step, counted against the challenge's own login
    {
      matcher: "/auth/mfa/challenges/:id/verify",
      methods: ["POST"],
      middlewares: [auditAuth("cp.auth.second_step"), guardSecondStep],
    },
    {
      matcher: "/admin/*",
      middlewares: [rateLimit(() => CP_RATE_LIMIT_PROFILES.admin_default)],
    },
    // C4 (adr/0061 §3.5): every request recorded once answered (refusals
    // too), then the staff guard: the route table's row, the credential,
    // 2FA, the step-up. Global, so they run before each route's own
    // validation and handler
    {
      matcher: "/admin/cp/*",
      middlewares: [auditCpRequests, guardCpStaff],
    },
    // Ek C9: the shops' signed API, its own group: the route table's row and
    // the shop's signature, never a staff credential (lib/fleet/tenant-api-routes.ts)
    {
      matcher: "/tenant-api/*",
      middlewares: [
        rateLimit(() => CP_RATE_LIMIT_PROFILES.tenant_api),
        guardTenantApi,
        // C13 review M1: then per verified shop, whatever its address
        rateLimit(() => CP_RATE_LIMIT_PROFILES.tenant_api_signer, {
          identity: (req) => tenantCallerOf(req)?.tenantId,
        }),
      ],
    },
    // Ek C13: the usage report's signature covers its exact bytes; held to 4 KB (413 past it)
    {
      matcher: "/tenant-api/v1/usage",
      methods: ["POST"],
      bodyParser: { sizeLimit: USAGE_REPORT_MAX_BYTES, preserveRawBody: true },
    },
    ...CP_ROUTE_MIDDLEWARES,
    ...TENANT_ROUTE_MIDDLEWARES,
    ...VAULT_ROUTE_MIDDLEWARES,
    ...FLEET_ROUTE_MIDDLEWARES,
  ],
})
