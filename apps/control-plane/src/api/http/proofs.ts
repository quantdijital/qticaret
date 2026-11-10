import type { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  TOTP_CODE,
  checkStepUpProof,
  countScopedWrongProof,
  firstCodeUse,
  issueStepUpProof,
  proofBurstExceeded,
  scopedProofsLocked,
  stepUpKey,
} from "@qticaret/server-kit"
import type { StepUpCheck } from "@qticaret/server-kit"
import { appKey, authOf, credentialOf, credentialScope, keyed } from "./caller"
import { sharedRateLimitStore } from "./rate-limit"
import { loggerOf } from "./request"

/**
 * Proving oneself again (adr/0061 §3.5; the shop's adr/0040 §3 rules,
 * @qticaret/server-kit): a 2FA code (once), a recovery code, or the
 * password while 2FA is being set up. Counted per person and credential
 * (Ek C4, M2): a stolen session that guesses locks itself, not its
 * owner's own sessions; a ceiling across them still stops many at once.
 * The sign-in's second step counts in a scope of its own (M4).
 */

export type ProofMethod = "totp" | "recovery_code"
export type ProofOutcome = "ok" | "wrong" | "locked"

/** Where wrong proofs count: the credential, or the sign-in's own scope. */
export type ProofScope = string

export const SIGN_IN_SCOPE: ProofScope = "sign-in"

const person = (identity: string) => keyed("cp_reauth", identity)

/** The scope of the request's own credential. */
export const scopeOf = (req: MedusaRequest): ProofScope => credentialScope(credentialOf(req))

/** Whether a TOTP code is new for the identity; true once, then for two minutes never. */
export async function codeFirstUse(
  req: MedusaRequest,
  identity: string,
  code: string
): Promise<boolean> {
  return firstCodeUse(sharedRateLimitStore(req), keyed("cp_reauth", `${identity}\n${code}`))
}

/** Whether the scope is locked, without counting an attempt. */
export const proofsLockedIn = (req: MedusaRequest, identity: string, scope: ProofScope) =>
  scopedProofsLocked(sharedRateLimitStore(req), person(identity), scope)

/** Locked, or past the minute's bound in this scope: no proof is checked. Counts the attempt. */
export async function proofGate(
  req: MedusaRequest,
  identity: string,
  scope: ProofScope = scopeOf(req)
): Promise<boolean> {
  const locked = await proofsLockedIn(req, identity, scope)
  const burst = await proofBurstExceeded(sharedRateLimitStore(req), `${person(identity)}:${scope}`)
  return !locked && !burst
}

/** One wrong proof more for the identity in the scope. */
export const countWrong = (
  req: MedusaRequest,
  identity: string,
  scope: ProofScope = scopeOf(req)
): Promise<void> => countScopedWrongProof(sharedRateLimitStore(req), person(identity), scope)

async function verifies(
  req: MedusaRequest,
  identity: string,
  method: ProofMethod,
  code: string
): Promise<boolean> {
  if (method === "totp" && (!TOTP_CODE.test(code) || !(await codeFirstUse(req, identity, code)))) {
    return false
  }
  const auth = req.scope.resolve(Modules.AUTH)
  try {
    const challenge = await auth.createAuthMfaChallenge({ auth_identity_id: identity })
    await auth.verifyAuthMfaChallenge({
      id: challenge.id,
      method,
      code,
      auth_identity_id: identity,
    })
    return true
  } catch {
    return false
  }
}

/** Whether `code` proves the identity: its app's code (once) or a recovery code (once). */
export async function proveFactor(
  req: MedusaRequest,
  identity: string,
  method: ProofMethod,
  code: string
): Promise<ProofOutcome> {
  if (!(await proofGate(req, identity))) {
    return "locked"
  }
  const ok = await verifies(req, identity, method, code.trim()).catch((error: unknown) => {
    loggerOf(req)?.warn(`cp.step_up_error ${JSON.stringify({ name: (error as Error).name })}`)
    return false
  })
  if (!ok) {
    await countWrong(req, identity)
    return "wrong"
  }
  return "ok"
}

/** Whether `password` is the identity's own (emailpass), in the same counts. */
export async function provePassword(
  req: MedusaRequest,
  identity: string,
  email: string,
  password: string
): Promise<ProofOutcome> {
  if (!(await proofGate(req, identity))) {
    return "locked"
  }
  const result = await req.scope
    .resolve(Modules.AUTH)
    .authenticate("emailpass", { body: { email, password } })
    .catch(() => null)
  if (result?.success !== true || result.authIdentity?.id !== identity) {
    await countWrong(req, identity)
    return "wrong"
  }
  return "ok"
}

/**
 * What a step-up proof is bound to (L4): the user, their login, and the
 * credential itself (the session's id, or the token's own id).
 */
function bindingOf(req: MedusaRequest): string | null {
  const auth = authOf(req)
  if (auth?.actor_type !== "user" || !auth.actor_id || !auth.auth_identity_id) {
    return null
  }
  return `${auth.actor_id}\n${auth.auth_identity_id}\n${scopeOf(req)}`
}

let proofKey: Buffer | undefined
const key = () => (proofKey ??= stepUpKey(appKey()))

/** A new step-up proof for the caller (five minutes). */
export function issueProof(req: MedusaRequest): { token: string; expiresAt: number } | null {
  const binding = bindingOf(req)
  return binding ? issueStepUpProof(binding, key()) : null
}

/** Whether the request carries a proof of its own caller that still holds. */
export function checkProof(req: MedusaRequest, token: string): StepUpCheck {
  const binding = bindingOf(req)
  return binding ? checkStepUpProof(token, binding, key()) : "invalid"
}
