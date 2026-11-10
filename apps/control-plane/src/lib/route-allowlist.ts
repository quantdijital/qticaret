/**
 * The control plane's boundary (adr/0061 §1.1): Medusa's commerce routes
 * stay registered but unreachable. Only these paths, and what lies under
 * them, are answered; every other path is a 404 before any core middleware
 * or handler runs. Paths are compared as Express routes them (`routePathOf`:
 * lower-cased, no trailing slash), so `/ADMIN/Products/` is `/admin/products`.
 *
 * - `/health`: liveness, nothing else
 * - `/auth/user/*`, `/auth/session`, `/auth/token/refresh`: staff sign-in.
 *   Only the `user` actor: there are no customers here
 * - `/auth/mfa/challenges/*`: a sign-in's 2FA step (C4). Medusa's own
 *   factor and recovery-code routes stay out: setting 2FA up goes through
 *   `/admin/cp/me/mfa*`, with its password, step-up and audit
 * - `/admin/cp/*`: the control plane's own admin API (Medusa authenticates
 *   every `/admin` route)
 * - `/tenant-api/*`: the shops' signed calls (adr/0061 §3.2)
 */
export const ALLOWED_ROUTES: readonly string[] = [
  "/health",
  "/auth/user",
  "/auth/session",
  "/auth/token/refresh",
  "/auth/mfa/challenges",
  "/admin/cp",
  "/tenant-api",
]

/** Whether a route path (`routePathOf`) is one the control plane answers. */
export function isAllowedRoute(path: string): boolean {
  return ALLOWED_ROUTES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
