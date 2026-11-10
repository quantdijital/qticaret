import { codeOf, statusOf } from "./api"
import { forgetStepUp } from "./step-up"

/** The pages open without a session: a refusal there is the page's own to show. */
export const PUBLIC_PAGES = ["/login", "/invite", "/enrol"] as const

export const isPublicPage = (pathname: string): boolean =>
  PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))

export type SessionTarget = "/login" | "/security/setup" | "/no-access"

/**
 * Where a refusal sends a member who was inside the panel (adr/0061 Ek C4):
 * no session any more (401: expired, ended from another session, a
 * deactivation) to sign-in; 2FA no longer passed (403 `cp.mfa_required`:
 * turned off or reset) to its setup; no role (403 `cp.no_role`) to the page
 * that says so. A 428 is the step-up dialog's; anything else the screen's.
 */
export function sessionTargetOf(error: unknown): SessionTarget | null {
  const status = statusOf(error)
  if (status === 401) {
    return "/login"
  }
  if (status === 403 && codeOf(error) === "cp.mfa_required") {
    return "/security/setup"
  }
  if (status === 403 && codeOf(error) === "cp.no_role") {
    return "/no-access"
  }
  return null
}

/**
 * The query and mutation caches' error hook: a refusal of the session
 * leads away from the page, once, with what was read forgotten.
 */
export function onSessionError(
  error: unknown,
  deps: { pathname: () => string; navigate: (to: SessionTarget) => void; clear: () => void }
): void {
  const pathname = deps.pathname()
  const target = sessionTargetOf(error)
  if (!target || isPublicPage(pathname) || pathname === target) {
    return
  }
  if (target === "/login") {
    forgetStepUp()
    deps.clear()
  }
  deps.navigate(target)
}
