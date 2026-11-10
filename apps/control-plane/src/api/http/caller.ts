import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { parseEnv } from "../../lib/env"
import { CP_STAFF_MODULE } from "../../modules/cp-staff"
import type CpStaffModuleService from "../../modules/cp-staff/service"

/**
 * Who is calling (adr/0061 §3.5): the signed-in staff member as Medusa's
 * authentication left them, and the keyed hashes the control plane counts
 * and records people and addresses by (`CP_HASH_KEY`), never in the clear.
 */

export const authOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context

/** The signed-in user's id; undefined for a key, a login without a user, or nobody. */
export function userIdOf(req: MedusaRequest): string | undefined {
  const auth = authOf(req)
  return auth?.actor_type === "user" && auth.actor_id ? auth.actor_id : undefined
}

let hashKey: Buffer | undefined

/** The app key behind every keyed hash and the step-up proofs. */
export function appKey(): Buffer {
  hashKey ??= parseKey(parseEnv().CP_HASH_KEY, "CP_HASH_KEY")
  return hashKey
}

/** A keyed hash for one purpose: equal inputs match, nothing reads back. */
export const keyed = (purpose: string, value: string, length = 32): string =>
  hashPii(value, appKey(), purpose).slice(0, length)

export const cpStaff = (req: MedusaRequest) =>
  req.scope.resolve<CpStaffModuleService>(CP_STAFF_MODULE)

/** Whether the identity has an enabled 2FA factor. */
export async function hasEnabledFactor(req: MedusaRequest, identity: string): Promise<boolean> {
  const factors = await req.scope
    .resolve(Modules.AUTH)
    .listAuthMfa({ auth_identity_id: identity, status: "enabled" }, { select: ["id"], take: 1 })
  return factors.length > 0
}

/** Whether 2FA is asked at all: always, but a developer's `ADMIN_MFA=off` on their machine. */
export const mfaEnforced = (): boolean => parseEnv().ADMIN_MFA !== "off"

/**
 * Whether this session passed 2FA: Medusa marks a session whose sign-in
 * code was verified, and the factor it passed is still on (a factor turned
 * off or reset ends what it opened).
 */
export async function mfaPassed(req: MedusaRequest): Promise<boolean> {
  if (!mfaEnforced()) {
    return true
  }
  const auth = authOf(req)
  if (!auth?.mfa_challenge_completed_at || !auth.auth_identity_id) {
    return false
  }
  return hasEnabledFactor(req, auth.auth_identity_id)
}
