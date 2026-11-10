import type { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  TOTP_CODE,
  checkStepUpProof,
  countWrongProof,
  firstCodeUse,
  issueStepUpProof,
  proofBurstExceeded,
  proofsLocked,
  stepUpKey,
} from "@qticaret/server-kit"
import type { StepUpCheck } from "@qticaret/server-kit"
import { appKey, authOf, keyed } from "./caller"
import { sharedRateLimitStore } from "./rate-limit"
import { loggerOf } from "./request"

/**
 * Proving oneself again (adr/0061 §3.5; the shop's adr/0040 §3 rules and
 * counters, @qticaret/server-kit): a 2FA code (once), a recovery code, or
 * the password while 2FA is being set up. Ten wrong proofs in a quarter of
 * an hour, thirty in a day, lock the person's proofs; ten a minute at most.
 */

export type ProofMethod = "totp" | "recovery_code"
export type ProofOutcome = "ok" | "wrong" | "locked"

const person = (identity: string) => keyed("cp_reauth", identity)

/** Whether a TOTP code is new for the identity; true once, then for two minutes never. */
export async function codeFirstUse(
  req: MedusaRequest,
  identity: string,
  code: string
): Promise<boolean> {
  return firstCodeUse(sharedRateLimitStore(req), keyed("cp_reauth", `${identity}\n${code}`))
}

/** Locked or past the minute's bound: no proof is checked. Counts the attempt. */
export async function proofGate(req: MedusaRequest, identity: string): Promise<boolean> {
  const store = sharedRateLimitStore(req)
  const locked = await proofsLocked(store, person(identity))
  const burst = await proofBurstExceeded(store, person(identity))
  return !locked && !burst
}

/** One wrong proof more for the identity. */
export const countWrong = (req: MedusaRequest, identity: string): Promise<void> =>
  countWrongProof(sharedRateLimitStore(req), person(identity))

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

interface SessionLike {
  session?: { auth_context?: unknown } | null
  sessionID?: string
}

/**
 * What a step-up proof is bound to: the user, their login, and the session
 * when the request signed in with one (a bearer token has none of its own).
 */
function bindingOf(req: MedusaRequest): string | null {
  const auth = authOf(req)
  if (auth?.actor_type !== "user" || !auth.actor_id || !auth.auth_identity_id) {
    return null
  }
  const { session, sessionID } = req as unknown as SessionLike
  const sid = session?.auth_context && sessionID ? sessionID : "bearer"
  return `${auth.actor_id}\n${auth.auth_identity_id}\n${sid}`
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
