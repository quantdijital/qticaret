import type { Me } from "./api"

export type Standing = "through" | "setup" | "sign-in-again"

/**
 * Where a signed-in member stands (adr/0061 Ek C4): through to the panel
 * (granted, 2FA on and passed by this session); to the 2FA setup (a new
 * member, after a reset, after turning their own off); or to sign in
 * again with a code (2FA on, but this session has not passed it, e.g. the
 * session the setup itself ran in).
 */
export function standingOf(me: Me): Standing {
  if (me.pending || !me.mfa.enabled) {
    return "setup"
  }
  return me.role !== null && me.mfa.passed ? "through" : "sign-in-again"
}
