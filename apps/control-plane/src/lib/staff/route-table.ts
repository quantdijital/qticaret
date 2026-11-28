import { CP_STAFF_ROLES } from "./roles"
import type { CpStaffRole } from "./roles"
import { AI_ROUTES } from "./route-table-ai"
import { BILLING_ROUTES } from "./route-table-billing"
import { FLEET_ROUTES } from "./route-table-fleet"
import { PROVISIONING_ROUTES } from "./route-table-provisioning"

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
 *
 * `/tenant-api/*` is not here and never will be (Ek C9): the shops' signed
 * API is its own group with its own table (lib/fleet/tenant-api-routes.ts);
 * no staff credential opens it and no shop signature opens this one.
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
  /**
   * A sign-in that passed 2FA in the last few minutes stands in for the
   * step-up (M2: a member whose proofs a stolen session locked can still
   * sign in again and end it).
   */
  freshSignIn?: true
  /** What it acts on, for the audit row: a kind and the parameter naming one. */
  resource?: { type: string; param?: string }
  /** A read of other people's data: an audit row too (`sensitive_read`). */
  auditRead?: true
  /**
   * The handler writes its row before it shows anything, and shows nothing
   * when the row cannot be written (a TCKN, Ek C4 L6); the middleware then
   * records only refusals.
   */
  auditBefore?: true
}

const ALL = CP_STAFF_ROLES
const OWNER = ["owner"] as const
// Shops (adr/0061 §3.5): the operator opens and runs them, notes, packages, exceptions
const SHOPS = ["owner", "operator"] as const
// A shop's company is the invoice's addressee: finance keeps it too
const INVOICED = ["owner", "operator", "finance"] as const
// Packages and their prices: finance's
const PACKAGES = ["owner", "finance"] as const

const TENANT = { type: "tenant", param: "id" } as const
const PACKAGE = { type: "package", param: "id" } as const

const shopRules = (method: Method, paths: string[], access: Access): RouteRule[] =>
  paths.map((path) => ({ method, path: `/admin/cp/tenants/:id${path}`, access, resource: TENANT }))

/** The shops (C7, adr/0061 §2): every change recorded against the shop, so its activity reads it. */
const TENANT_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/tenants", access: ALL },
  // A new record may name its package, which sets what the shop pays: proved again (review M1)
  {
    method: "POST",
    path: "/admin/cp/tenants",
    access: SHOPS,
    stepUp: true,
    resource: { type: "tenant" },
  },
  // Its contacts are people's data: the read is recorded before the answer (review M2)
  {
    method: "GET",
    path: "/admin/cp/tenants/:id",
    access: ALL,
    resource: TENANT,
    auditRead: true,
    auditBefore: true,
  },
  { method: "GET", path: "/admin/cp/tenants/:id/activity", access: ALL, resource: TENANT },
  // Ek C13: its usage totals and health probes, read by all (no personal data: not recorded)
  { method: "GET", path: "/admin/cp/tenants/:id/usage-health", access: ALL, resource: TENANT },
  // C11: a new shop's address checked while typed, by who may make one; no personal data
  { method: "GET", path: "/admin/cp/tenant-availability", access: SHOPS },
  ...shopRules(
    "POST",
    [
      "",
      "/contacts",
      "/contacts/:contact_id",
      "/domains",
      "/domains/:domain_id/primary",
      "/notes",
      "/notes/:note_id",
      "/overrides",
      // Ek C9: a platform flag's exception, beside the limits' (no step-up, as theirs)
      "/feature-overrides",
    ],
    SHOPS
  ),
  // The shop's package sets what it pays: proved again, as a price change (review M1)
  {
    method: "POST",
    path: "/admin/cp/tenants/:id/plan",
    access: SHOPS,
    stepUp: true,
    resource: TENANT,
  },
  ...shopRules(
    "DELETE",
    [
      "/contacts/:contact_id",
      "/domains/:domain_id",
      "/notes/:note_id",
      "/overrides/:key",
      "/feature-overrides/:key",
    ],
    SHOPS
  ),
  // Ek C15: a suspension and its end (adr/0061 §3.5 "askıya alma, geri açma"): who runs
  // shops, proved again; it darkens or opens a storefront
  ...["/suspend", "/resume"].map((action): RouteRule => ({
    method: "POST",
    path: `/admin/cp/tenants/:id${action}`,
    access: SHOPS,
    stepUp: true,
    resource: TENANT,
  })),
  // adr/0061 Ek "Destek erişimi" (2026-11-28) Karar 7: a signed, single-use grant into the
  // shop's panel; proved again every time (a fresh sign-in does not stand in)
  {
    method: "POST",
    path: "/admin/cp/tenants/:id/support-grants",
    access: SHOPS,
    stepUp: true,
    resource: TENANT,
  },
  ...shopRules("POST", ["/company"], INVOICED),
  // A sole proprietor's TCKN: proved again, recorded before it is shown
  {
    method: "POST",
    path: "/admin/cp/tenants/:id/reveal-tckn",
    access: INVOICED,
    stepUp: true,
    auditBefore: true,
    resource: TENANT,
  },
]

/** The packages (C7): read by all; made, changed and archived by finance; a price and the trial and grace days behind a step-up. */
const PLAN_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/plans", access: ALL },
  // C12: the sector packs' manifests and counts, read by all as the packages are (no personal data)
  { method: "GET", path: "/admin/cp/sector-packs", access: ALL },
  // A new package sets a price: proved again, as a price change (review M1)
  {
    method: "POST",
    path: "/admin/cp/plans",
    access: PACKAGES,
    stepUp: true,
    resource: { type: "package" },
  },
  ...["", "/archive", "/restore"].map((action): RouteRule => ({
    method: "POST",
    path: `/admin/cp/plans/:id${action}`,
    access: PACKAGES,
    resource: PACKAGE,
  })),
  {
    method: "POST",
    path: "/admin/cp/plans/:id/price",
    access: PACKAGES,
    stepUp: true,
    resource: PACKAGE,
  },
  // Ek C19 L1: the trial and grace days bear money as the price does (one
  // shop's grace days already asked the proof)
  {
    method: "POST",
    path: "/admin/cp/plans/:id/terms",
    access: PACKAGES,
    stepUp: true,
    resource: PACKAGE,
  },
]

/**
 * The keys (C8, adr/0061 §3.5 "owner: key rotation"): the owner's alone.
 * Reading them shows fingerprints, public keys and counts only; every
 * change (a new signing key, the switch, retiring one, a rewrap) asks the
 * proof. Other roles have no use for them and see none (Ek C8).
 */
const KEY_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/keys", access: OWNER },
  {
    method: "POST",
    path: "/admin/cp/keys/rewrap",
    access: OWNER,
    stepUp: true,
    resource: { type: "cp_kek" },
  },
  ...["prepare", "switch", "retire"].map((action): RouteRule => ({
    method: "POST",
    path: `/admin/cp/keys/signing/${action}`,
    access: OWNER,
    stepUp: true,
    resource: { type: "cp_signing_key" },
  })),
]

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
    freshSignIn: true,
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
  ...TENANT_ROUTES,
  ...PLAN_ROUTES,
  ...KEY_ROUTES,
  ...PROVISIONING_ROUTES,
  ...BILLING_ROUTES,
  ...FLEET_ROUTES,
  ...AI_ROUTES,
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
  /** Waiting for their first factor: the setup only. */
  pending?: boolean
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
  if (caller.pending === true || !caller.mfaPassed) {
    return { allowed: false, reason: "mfa_required" }
  }
  return rule.access.includes(caller.role)
    ? { allowed: true, reason: "role" }
    : { allowed: false, reason: "role" }
}
