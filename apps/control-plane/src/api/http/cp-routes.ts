import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import type { MedusaRequest, defineMiddlewares } from "@medusajs/framework/http"
import { CP_RATE_LIMIT_PROFILES } from "../../lib/rate-limit-profiles"
import {
  GetCpAuditLog,
  NoBody,
  NoQuery,
  PostCpInvite,
  PostCpInviteAccept,
  PostCpInviteInfo,
  PostCpMe,
  PostCpMemberRole,
  PostCpMfaVerify,
  PostCpStepUp,
} from "../admin/cp/validators"
import { credentialOf, credentialScope, userIdOf } from "./caller"
import { rateLimit } from "./rate-limit"

/**
 * What each `/admin/cp/*` route takes (adr/0061 §3.5): its body or query,
 * strictly, and the rate limits of the ones a guess could use. Who may
 * call is the route table's (lib/staff/route-table.ts), decided before
 * these by the staff guard.
 */

// Per member and credential (Ek C4, M2): a stolen session spending its tries
// leaves its owner's own session its full count
const byCredential = {
  identity: (req: MedusaRequest) => {
    const userId = userIdOf(req)
    return userId ? `${userId}:${credentialScope(credentialOf(req))}` : undefined
  },
}
const stepUpTries = rateLimit(() => CP_RATE_LIMIT_PROFILES.step_up, byCredential)
const setupTries = rateLimit(() => CP_RATE_LIMIT_PROFILES.mfa_setup, byCredential)
const publicTries = rateLimit(() => CP_RATE_LIMIT_PROFILES.invite_public)

const body = (schema: Parameters<typeof validateAndTransformBody>[0]) =>
  validateAndTransformBody(schema)
const noQuery = validateAndTransformQuery(NoQuery, {})

type MiddlewareConfig = Extract<Parameters<typeof defineMiddlewares>[0], { routes?: unknown }>
type MiddlewareRoute = NonNullable<MiddlewareConfig["routes"]>[number]
type Middleware = NonNullable<MiddlewareRoute["middlewares"]>[number]

const route = (
  matcher: string,
  method: "GET" | "POST" | "DELETE",
  middlewares: Middleware[]
): MiddlewareRoute => ({ matcher, methods: [method], middlewares })

const GETS = ["/admin/cp/me", "/admin/cp/me/sessions", "/admin/cp/staff"]

const DELETES = ["/admin/cp/me/mfa", "/admin/cp/me/sessions/:id", "/admin/cp/staff/invites/:id"]

const EMPTY_POSTS = [
  "/admin/cp/me/mfa/recovery-codes",
  "/admin/cp/me/sessions/revoke-others",
  "/admin/cp/staff/members/:id/deactivate",
  "/admin/cp/staff/members/:id/reactivate",
  "/admin/cp/staff/members/:id/reset-mfa",
]

export const CP_ROUTE_MIDDLEWARES = [
  ...GETS.map((matcher) => route(matcher, "GET", [noQuery])),
  ...DELETES.map((matcher) => route(matcher, "DELETE", [noQuery])),
  route("/admin/cp/audit-log", "GET", [validateAndTransformQuery(GetCpAuditLog, {})]),
  route("/admin/cp/me", "POST", [body(PostCpMe)]),
  route("/admin/cp/me/mfa", "POST", [setupTries, body(NoBody)]),
  route("/admin/cp/me/mfa/verify", "POST", [setupTries, body(PostCpMfaVerify)]),
  route("/admin/cp/me/step-up", "POST", [stepUpTries, body(PostCpStepUp)]),
  ...EMPTY_POSTS.map((matcher) => route(matcher, "POST", [body(NoBody)])),
  route("/admin/cp/staff/invites", "POST", [body(PostCpInvite)]),
  route("/admin/cp/staff/members/:id", "POST", [body(PostCpMemberRole)]),
  route("/admin/cp/invites/info", "POST", [publicTries, body(PostCpInviteInfo)]),
  route("/admin/cp/invites/accept", "POST", [
    publicTries,
    authenticate("user", ["bearer"], { allowUnregistered: true }),
    body(PostCpInviteAccept),
  ]),
]
