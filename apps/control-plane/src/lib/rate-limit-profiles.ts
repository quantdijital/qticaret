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
    // Ek C4 (M4): one account from every address together, an hour. Someone
    // who knows the address can hold its sign-in for that hour (open
    // sessions are untouched); a guesser spread over many addresses stops
    perIdentityAnyIp: { max: 50, windowMs: HOUR },
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
  // A 2FA code or a password proved: per address and per member (C4); the
  // wrong-proof lock (server-kit security/proofs) bounds guessing on top
  step_up: {
    name: "cp_step_up",
    perIp: { max: 30, windowMs: 15 * MINUTE },
    perIdentity: { max: 10, windowMs: 15 * MINUTE },
  },
  mfa_setup: {
    name: "cp_mfa_setup",
    perIp: { max: 30, windowMs: 15 * MINUTE },
    perIdentity: { max: 10, windowMs: 15 * MINUTE },
  },
  // An invitation's page and its acceptance, before any account: the link is the credential
  invite_public: { name: "cp_invite_public", perIp: { max: 20, windowMs: HOUR } },
  // Per address, before the signature: only what no signature vouched for (D4, tenant-api-address.ts)
  tenant_api: { name: "cp_tenant_api", perIp: { max: 300, windowMs: MINUTE } },
  // Ek C13 review M1: per shop as its signature proves it, every tenant API
  // route together (shops behind one address do not share a bucket)
  tenant_api_signer: {
    name: "cp_tenant_api_signer",
    perIdentityAnyIp: { max: 30, windowMs: MINUTE },
  },
  // adr/0085 §2: the AI credits' routes per verified shop, apart from the signer's 30 (P3b's calls too)
  tenant_api_ai: { name: "cp_tenant_api_ai", perIdentityAnyIp: { max: 60, windowMs: MINUTE } },
  // "Bağlantıyı dene" (adr/0085 §2): a provider called with the platform's key, per member
  ai_provider_check: {
    name: "cp_ai_provider_check",
    perIdentityAnyIp: { max: 6, windowMs: MINUTE },
  },
  // A sole proprietor's TCKN shown: per staff member from every address (C7 review L1)
  tckn_reveal: { name: "cp_tckn_reveal", perIdentityAnyIp: { max: 20, windowMs: HOUR } },
  // A support grant into a shop's panel (adr/0061 Ek 2026-11-28): per staff member, every address;
  // each also costs a fresh step-up (single use), so this only bounds a session gone wrong
  support_grant: { name: "cp_support_grant", perIdentityAnyIp: { max: 30, windowMs: HOUR } },
} as const satisfies Record<string, RateLimitProfile>

/**
 * PR #374 review Y1: the tenant API requests one address may have in
 * flight at once before a signature vouches for them; past it a request
 * is refused 429 before the store, the guard or the database is asked
 * (tenant-api-address.ts). Counted in this process only.
 */
export const CP_TENANT_API_MAX_IN_FLIGHT_PER_ADDRESS = 50

/** Each kind of /auth/* route (`authRouteKind`) and the profile it counts in. */
export const CP_AUTH_PROFILES: Readonly<Record<AuthRouteKind, RateLimitProfile>> = {
  token_refresh: CP_RATE_LIMIT_PROFILES.token_refresh,
  session: CP_RATE_LIMIT_PROFILES.auth_default,
  register: CP_RATE_LIMIT_PROFILES.register,
  password_reset: CP_RATE_LIMIT_PROFILES.password_reset,
  auth_default: CP_RATE_LIMIT_PROFILES.auth_default,
  login: CP_RATE_LIMIT_PROFILES.login,
}
