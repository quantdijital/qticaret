import type { AuthRouteKind, RateLimitProfile } from "@qticaret/server-kit"

/**
 * The control plane's rate limits (docs/04). A few staff and a few dozen
 * shops call it: the limits are tighter than a shop's. Staff sign-in counts
 * per address and per address and e-mail; a shop's signed calls (usage,
 * plan pull) per address.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const CP_RATE_LIMIT_PROFILES = {
  login: {
    name: "cp_login",
    perIp: { max: 20, windowMs: 15 * MINUTE },
    perIdentity: { max: 5, windowMs: 15 * MINUTE },
  },
  password_reset: {
    name: "cp_password_reset",
    perIp: { max: 10, windowMs: HOUR },
    perIdentity: { max: 3, windowMs: HOUR },
  },
  register: { name: "cp_register", perIp: { max: 10, windowMs: HOUR } },
  token_refresh: { name: "cp_token_refresh", perIp: { max: 60, windowMs: 15 * MINUTE } },
  auth_default: { name: "cp_auth_default", perIp: { max: 60, windowMs: 15 * MINUTE } },
  admin_default: { name: "cp_admin_default", perIp: { max: 600, windowMs: MINUTE } },
  tenant_api: { name: "cp_tenant_api", perIp: { max: 300, windowMs: MINUTE } },
} as const satisfies Record<string, RateLimitProfile>

/** Each kind of /auth/* route (`authRouteKind`) and the profile it counts in. */
export const CP_AUTH_PROFILES: Readonly<Record<AuthRouteKind, RateLimitProfile>> = {
  token_refresh: CP_RATE_LIMIT_PROFILES.token_refresh,
  session: CP_RATE_LIMIT_PROFILES.auth_default,
  register: CP_RATE_LIMIT_PROFILES.register,
  password_reset: CP_RATE_LIMIT_PROFILES.password_reset,
  auth_default: CP_RATE_LIMIT_PROFILES.auth_default,
  login: CP_RATE_LIMIT_PROFILES.login,
}
