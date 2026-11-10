/**
 * The control plane's boundary (adr/0061 §1.1): Medusa's commerce routes
 * stay registered but unreachable. Only these paths are answered; every
 * other path is a 404 before any core middleware or handler runs. Paths
 * are compared as Express routes them (`routePathOf`: lower-cased, no
 * trailing slash), so `/ADMIN/Products/` is `/admin/products`.
 *
 * Exactly these (Ek C4: no reset, update or callback route until a flow
 * exists for it; no `/auth/token/refresh`, which mints a new token from
 * any good one and would make a token outlive every revocation):
 * - `/health`: liveness, nothing else
 * - `/auth/user/emailpass` (sign-in), `/auth/user/emailpass/register`
 *   (only with an invitation, api/http/register-gate.ts), `/auth/session`
 *   (open and end a session). Only the `user` actor: no customers here
 *
 * And what lies under these:
 * - `/auth/mfa/challenges/*`: a sign-in's 2FA step (C4). Medusa's own
 *   factor and recovery-code routes stay out: setting 2FA up goes through
 *   `/admin/cp/me/mfa*`, with its password, step-up and audit
 * - `/admin/cp/*`: the control plane's own admin API (Medusa authenticates
 *   every `/admin` route)
 * - `/tenant-api/*`: the shops' signed calls (adr/0061 §3.2)
 */
export const ALLOWED_EXACT: readonly string[] = [
  "/health",
  "/auth/user/emailpass",
  "/auth/user/emailpass/register",
  "/auth/session",
]

export const ALLOWED_PREFIXES: readonly string[] = [
  "/auth/mfa/challenges",
  "/admin/cp",
  "/tenant-api",
]

/** Whether a route path (`routePathOf`) is one the control plane answers. */
export function isAllowedRoute(path: string): boolean {
  return (
    ALLOWED_EXACT.includes(path) ||
    ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  )
}
