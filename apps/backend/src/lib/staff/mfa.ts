import { isLocalEnv, parseEnv } from "../env"
import type { Env } from "../env"

export type MfaPolicy = "required" | "off"

/**
 * Whether this environment can ask staff for 2FA (F12.6, adr/0040 §2).
 * Where the shop runs, yes: the key is required there, and `ADMIN_MFA` is
 * ignored. Locally, when the key is set, unless `ADMIN_MFA=off` (read at
 * each request, so a test can turn it on); without the key Medusa cannot
 * keep a factor. Whether the shop asks it of everyone is the owner's
 * switch (`security.staff_mfa_required`).
 */
export function staffMfaPolicy(
  env: Pick<Env, "NODE_ENV" | "AUTH_MFA_ENCRYPTION_KEY"> = parseEnv(),
  adminMfa: string | undefined = process.env["ADMIN_MFA"]
): MfaPolicy {
  if (!isLocalEnv(env)) {
    return "required"
  }
  if (!env.AUTH_MFA_ENCRYPTION_KEY) {
    return "off"
  }
  return adminMfa === "off" ? "off" : "required"
}
