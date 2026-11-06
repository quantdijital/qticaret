import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostStaffEmail,
  AdminPostStaffEmailConfirm,
  AdminPostStaffEndSessions,
  AdminPostStaffPassword,
  AdminPostStaffProfile,
} from "../admin/staff/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { callerHasFactor, requireReauth } from "./reauth"

const callerOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

// A password tried against one's own account is a sign-in's guess: the login profile's
// count, per the member (adr/0040: ten in a quarter of an hour), whatever was sent
const passwordTries = rateLimit(() => RATE_LIMIT_PROFILES.login, { identity: callerOf })

// With 2FA on, its code too (adr/0040 §3): a password alone is what a stolen session may know
const secondFactor = requireReauth(callerHasFactor)

/**
 * A staff member's own account (the owner, 2026-11-06), for every role:
 * the role table lets each call act on the caller (lib/staff `OWN`); these
 * check who calls and what they send. The handlers read no id from the
 * request. The new address's link comes before a session.
 */
export const STAFF_ACCOUNT_ROUTES = [
  {
    matcher: "/admin/staff/me/profile",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
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
    ],
  },
  {
    matcher: "/admin/staff/me/email",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      passwordTries,
      validateAndTransformBody(AdminPostStaffEmail),
      secondFactor,
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
  // A link guessed finds nothing: counted per address as a sign-in's tries
  {
    matcher: "/admin/staff/email/confirm",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.login),
      validateAndTransformBody(AdminPostStaffEmailConfirm),
    ],
  },
]
