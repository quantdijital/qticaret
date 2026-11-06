import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostStaffEmail,
  AdminPostStaffEmailCancel,
  AdminPostStaffEmailConfirm,
  AdminPostStaffEndSessions,
  AdminPostStaffPassword,
  AdminPostStaffProfile,
} from "../admin/staff/validators"
import { requireUserActor } from "./actor"
import { proveOwnPassword } from "./own-password"
import { rateLimit } from "./rate-limit"
import { callerHasFactor, requireReauth } from "./reauth"
import { noteSessionEnd, noteSessionStart } from "./staff-sessions"

const callerOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

// Profiles of their own (security review 2026-11-06): none uses up sign-ins' budget.
// A password tried against one's own account, per member from any address
const passwordTries = rateLimit(() => RATE_LIMIT_PROFILES.own_password, { identity: callerOf })
// Each address change mails a stranger's inbox in the shop's name: a few a day
const emailAsks = rateLimit(() => RATE_LIMIT_PROFILES.staff_email_request, { identity: callerOf })
const confirmTries = rateLimit(() => RATE_LIMIT_PROFILES.staff_email_confirm, {
  identity: callerOf,
})

// With 2FA on, its code too (adr/0040 §3): a password alone is what a stolen session may know
const secondFactor = requireReauth(callerHasFactor)

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/**
 * A staff member's own account (the owner, 2026-11-06), for every role:
 * the role table lets each call act on the caller (lib/staff `OWN`); these
 * check who calls and what they send, and prove the current password
 * before any workflow. The handlers read no id from the request. A panel
 * sign-in notes its session for the member (api/http/staff-sessions.ts).
 */
export const STAFF_ACCOUNT_ROUTES = [
  ...["/admin/staff/me/profile", "/admin/staff/me/sessions"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  })),
  {
    matcher: "/admin/staff/me/profile",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostStaffProfile)],
  },
  {
    matcher: "/admin/staff/me/password",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      passwordTries,
      validateAndTransformBody(AdminPostStaffPassword),
      secondFactor,
      proveOwnPassword,
    ],
  },
  {
    matcher: "/admin/staff/me/email",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      passwordTries,
      emailAsks,
      validateAndTransformBody(AdminPostStaffEmail),
      secondFactor,
      proveOwnPassword,
    ],
  },
  {
    matcher: "/admin/staff/me/email/cancel",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostStaffEmailCancel)],
  },
  // The link is confirmed by the member it was asked for, signed in
  {
    matcher: "/admin/staff/me/email/confirm",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      confirmTries,
      validateAndTransformBody(AdminPostStaffEmailConfirm),
    ],
  },
  // Signing out elsewhere asks the proof too: a stolen session must not lock its owner out
  {
    matcher: "/admin/staff/me/sessions/end-others",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(AdminPostStaffEndSessions),
      requireReauth(),
    ],
  },
  { matcher: "/auth/session", methods: ["POST" as const], middlewares: [noteSessionStart] },
  { matcher: "/auth/session", methods: ["DELETE" as const], middlewares: [noteSessionEnd] },
]
