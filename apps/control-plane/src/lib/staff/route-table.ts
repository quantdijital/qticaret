import { CP_STAFF_ROLES } from "./roles"
import type { CpStaffRole } from "./roles"

/**
 * Every `/admin/cp/*` route and who may call it (adr/0061 §3.5, the shop's
 * adr/0040 table made explicit): a route that is not here answers 404 to
 * everyone, and a unit test fails on a route file without a row or a row
 * without a route file. One table decides the role, the 2FA exemption, the
 * step-up and the audit, so they never disagree.
 *
 * `access`:
 * - `public`: no session (the route sets `AUTHENTICATE = false`): an
 *   invitation's page and its acceptance
 * - `setup`: any active staff member before their 2FA is passed: who they
 *   are and setting 2FA up, nothing else
 * - a list of roles: active staff who passed 2FA, in one of those roles
 */

export type Method = "GET" | "POST" | "DELETE"
export type Access = "public" | "setup" | readonly CpStaffRole[]

export interface RouteRule {
  method: Method
  /** Lower-cased as Express routes it; `:name` is one path segment. */
  path: string
  access: Access
  /** A fresh step-up proof required (`x-cp-step-up`, adr/0061 §3.5). */
  stepUp?: true
  /** What it acts on, for the audit row: a kind and the parameter naming one. */
  resource?: { type: string; param?: string }
  /** A read of other people's data: an audit row too (`sensitive_read`). */
  auditRead?: true
}

const ALL = CP_STAFF_ROLES
const OWNER = ["owner"] as const

export const CP_ROUTES: readonly RouteRule[] = [
  // One's own account: who they are, before 2FA too, so the panel can lead to setup
  { method: "GET", path: "/admin/cp/me", access: "setup", resource: { type: "cp_user" } },
  { method: "POST", path: "/admin/cp/me", access: ALL, resource: { type: "cp_user" } },
  // 2FA setup: started and confirmed (with the password) before it is passed
  { method: "POST", path: "/admin/cp/me/mfa", access: "setup", resource: { type: "cp_mfa" } },
  {
    method: "POST",
    path: "/admin/cp/me/mfa/verify",
    access: "setup",
    resource: { type: "cp_mfa" },
  },
  // Turned off (to set it up again) or new recovery codes: a stolen session must not
  {
    method: "DELETE",
    path: "/admin/cp/me/mfa",
    access: ALL,
    stepUp: true,
    resource: { type: "cp_mfa" },
  },
  {
    method: "POST",
    path: "/admin/cp/me/mfa/recovery-codes",
    access: ALL,
    stepUp: true,
    resource: { type: "cp_mfa" },
  },
  // Proving oneself again: the code in, a short-lived proof out
  { method: "POST", path: "/admin/cp/me/step-up", access: ALL, resource: { type: "cp_step_up" } },
  // One's own sessions; ending them asks the proof (a stolen one must not lock its owner out)
  { method: "GET", path: "/admin/cp/me/sessions", access: ALL },
  {
    method: "DELETE",
    path: "/admin/cp/me/sessions/:id",
    access: ALL,
    stepUp: true,
    resource: { type: "cp_session" },
  },
  {
    method: "POST",
    path: "/admin/cp/me/sessions/revoke-others",
    access: ALL,
    stepUp: true,
    resource: { type: "cp_session" },
  },
  // The staff: the owner's alone; every change that grants or keeps access asks the proof
  { method: "GET", path: "/admin/cp/staff", access: OWNER, auditRead: true },
  {
    method: "POST",
    path: "/admin/cp/staff/invites",
    access: OWNER,
    stepUp: true,
    resource: { type: "cp_invite" },
  },
  // Withdrawing an invitation only takes access away
  {
    method: "DELETE",
    path: "/admin/cp/staff/invites/:id",
    access: OWNER,
    resource: { type: "cp_invite", param: "id" },
  },
  ...["", "/deactivate", "/reactivate", "/reset-mfa"].map((action): RouteRule => ({
    method: "POST",
    path: `/admin/cp/staff/members/:id${action}`,
    access: OWNER,
    stepUp: true,
    resource: { type: "cp_staff_member", param: "id" },
  })),
  // An invitation's page and its acceptance: the link is the credential
  {
    method: "POST",
    path: "/admin/cp/invites/info",
    access: "public",
    resource: { type: "cp_invite" },
  },
  {
    method: "POST",
    path: "/admin/cp/invites/accept",
    access: "public",
    resource: { type: "cp_invite" },
  },
  // The audit log: the owner's alone, and reading it is recorded too
  { method: "GET", path: "/admin/cp/audit-log", access: OWNER, auditRead: true },
]

const compiled = new Map<string, RegExp>()

function patternOf(path: string): RegExp {
  let pattern = compiled.get(path)
  if (!pattern) {
    const body = path
      .split("/")
      .map((part) =>
        part.startsWith(":")
          ? `(?<${part.slice(1)}>[^/]+)`
          : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      )
      .join("/")
    pattern = new RegExp(`^${body}$`, "i")
    compiled.set(path, pattern)
  }
  return pattern
}

export interface RouteMatch {
  rule: RouteRule
  /** The path's parameters as written (case kept), not yet decoded. */
  params: Record<string, string>
}

/** The table's row for a request, by method and path (case kept, no query); null when none. */
export function matchRoute(method: string, path: string): RouteMatch | null {
  const verb = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase()
  for (const rule of CP_ROUTES) {
    if (rule.method !== verb) {
      continue
    }
    const found = patternOf(rule.path).exec(path)
    if (found) {
      return { rule, params: { ...found.groups } }
    }
  }
  return null
}

export type Decision =
  | { allowed: true; reason: "public" | "setup" | "role" }
  | { allowed: false; reason: "unlisted" | "no_role" | "mfa_required" | "role" }

export interface Caller {
  /** The active member's role; null for a user who is not, or no longer, staff. */
  role: CpStaffRole | null
  /** Whether this session passed 2FA with a factor still enabled. */
  mfaPassed: boolean
}

/** Whether `caller` may call the rule's route. Closed by default. */
export function decide(rule: RouteRule | null, caller: Caller): Decision {
  if (!rule) {
    return { allowed: false, reason: "unlisted" }
  }
  if (rule.access === "public") {
    return { allowed: true, reason: "public" }
  }
  if (caller.role === null) {
    return { allowed: false, reason: "no_role" }
  }
  if (rule.access === "setup") {
    return { allowed: true, reason: "setup" }
  }
  if (!caller.mfaPassed) {
    return { allowed: false, reason: "mfa_required" }
  }
  return rule.access.includes(caller.role)
    ? { allowed: true, reason: "role" }
    : { allowed: false, reason: "role" }
}
