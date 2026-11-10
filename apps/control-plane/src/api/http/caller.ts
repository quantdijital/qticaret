import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { isLocalEnv, parseEnv } from "../../lib/env"
import { sessionIndex } from "../../lib/staff/session-index"
import type { CpStaffRole } from "../../lib/staff/roles"
import { CP_STAFF_MODULE } from "../../modules/cp-staff"
import type CpStaffModuleService from "../../modules/cp-staff/service"
import type { MemberState } from "../../modules/cp-staff/service"

/**
 * Who is calling (adr/0061 §3.5): the signed-in staff member as Medusa's
 * authentication left them, the credential they came with, and the keyed
 * hashes the control plane counts and records people and addresses by
 * (`CP_HASH_KEY`), never in the clear.
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

interface SessionLike {
  session?: { auth_context?: { actor_id?: unknown } | null } | null
  sessionID?: string
}

export type Credential =
  | { kind: "session"; sid: string }
  | {
      kind: "bearer"
      iat: number | null
      jti: string | null
      /** When the token's sign-in passed 2FA, if it did. */
      mfaPassedAt: string | null
    }

/** The payload of the request's bearer token: Medusa has verified it by now. */
function bearerClaims(
  req: MedusaRequest
): { iat?: unknown; jti?: unknown; mfa_challenge_completed_at?: unknown } | null {
  const header = req.headers.authorization ?? ""
  const [, payload] = /^Bearer\s+[^.]+\.([^.]+)\.[^.]+$/i.exec(header) ?? []
  if (!payload) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

/** How the caller authenticated: Medusa reads a session before a bearer token. */
export function credentialOf(req: MedusaRequest): Credential {
  const { session, sessionID } = req as unknown as SessionLike
  const actor = session?.auth_context?.actor_id
  if (typeof actor === "string" && actor !== "" && sessionID) {
    return { kind: "session", sid: sessionID }
  }
  const claims = bearerClaims(req)
  return {
    kind: "bearer",
    iat: typeof claims?.iat === "number" ? claims.iat : null,
    jti: typeof claims?.jti === "string" ? claims.jti : null,
    mfaPassedAt:
      typeof claims?.mfa_challenge_completed_at === "string"
        ? claims.mfa_challenge_completed_at
        : null,
  }
}

/** A stable id of the credential, for binding proofs and counting them (never the secret). */
export function credentialScope(credential: Credential): string {
  return credential.kind === "session"
    ? `s:${keyed("cp_session", credential.sid, 24)}`
    : `b:${credential.jti ?? String(credential.iat ?? "none")}`
}

/** Whether the identity has an enabled 2FA factor. */
export async function hasEnabledFactor(req: MedusaRequest, identity: string): Promise<boolean> {
  const factors = await req.scope
    .resolve(Modules.AUTH)
    .listAuthMfa({ auth_identity_id: identity, status: "enabled" }, { select: ["id"], take: 1 })
  return factors.length > 0
}

/** Whether 2FA is asked at all: always, but a developer's `ADMIN_MFA=off` on their machine. */
export const mfaEnforced = (): boolean => parseEnv().ADMIN_MFA !== "off"

export type CredentialCheck = "ok" | "session_revoked" | "token_revoked" | "session_required"

/**
 * Whether the credential still holds (Ek C4, M1): a session only while its
 * id is in the member's index; a bearer token only in development and
 * test, and only if issued after the member's last revocation.
 */
export async function checkCredential(
  credential: Credential,
  userId: string,
  member: MemberState | null,
  deployed = !isLocalEnv(parseEnv())
): Promise<CredentialCheck> {
  if (credential.kind === "session") {
    return (await sessionIndex().has(userId, credential.sid)) ? "ok" : "session_revoked"
  }
  if (deployed) {
    return "session_required"
  }
  const after = member?.tokensValidAfter?.getTime()
  if (after === undefined) {
    return "ok"
  }
  // A token that passed 2FA is judged by when it did (milliseconds); one
  // that did not (it reaches the setup only) by its issue second
  const passedAt = credential.mfaPassedAt ? new Date(credential.mfaPassedAt).getTime() : null
  const fresh =
    passedAt !== null && !Number.isNaN(passedAt)
      ? passedAt >= after
      : credential.iat !== null && credential.iat >= Math.floor(after / 1000)
  return fresh ? "ok" : "token_revoked"
}

/**
 * Whether this sign-in passed 2FA (H1): Medusa's mark on it, no older than
 * the member's last factor change, and a factor still on.
 */
export async function mfaPassed(req: MedusaRequest, member: MemberState | null): Promise<boolean> {
  if (!mfaEnforced()) {
    return true
  }
  const auth = authOf(req)
  const completed = auth?.mfa_challenge_completed_at
  if (!completed || !auth.auth_identity_id) {
    return false
  }
  const at = new Date(completed).getTime()
  if (Number.isNaN(at) || (member?.mfaValidAfter && at < member.mfaValidAfter.getTime())) {
    return false
  }
  return hasEnabledFactor(req, auth.auth_identity_id)
}

/** The member's standing: granted role, waiting for 2FA (by a deadline), or nothing. */
export function standingOf(
  member: MemberState | null,
  now: number = Date.now()
): { role: CpStaffRole | null; pending: boolean } {
  if (!member?.active) {
    return { role: null, pending: false }
  }
  if (member.enrolBy === null) {
    return { role: member.role, pending: false }
  }
  return member.enrolBy.getTime() > now
    ? { role: member.role, pending: true }
    : { role: null, pending: false }
}
