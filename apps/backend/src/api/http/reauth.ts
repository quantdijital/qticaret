import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  TOTP_CODE,
  countWrongProof as countWrongProofIn,
  firstCodeUse,
  hashPii,
  parseKey,
  proofBurstExceeded,
  proofsLocked as proofsLockedIn,
} from "@qticaret/server-kit"
import { parseEnv } from "../../lib/env"
import { errorSummary, logger } from "../../lib/logging"
import { sharedRateLimitStore } from "./rate-limit"
import { rejectRequest } from "./reject"

const METHODS = ["totp", "recovery_code", "password"] as const
type Method = (typeof METHODS)[number]

// The counters and their limits are shared with the control plane
// (@qticaret/server-kit security/proofs): ten wrong proofs in a quarter of
// an hour or thirty in a day lock, ten a minute at most, a code once

let hashKey: Buffer | undefined
const keyed = (value: string): string => {
  hashKey ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  return hashPii(value, hashKey, "reauth").slice(0, 32)
}

type When = (req: MedusaRequest) => boolean | Promise<boolean>

const authOf = (req: MedusaRequest) => (req as Partial<AuthenticatedMedusaRequest>).auth_context

async function hasFactor(req: MedusaRequest, identity: string): Promise<boolean> {
  const factors = await req.scope
    .resolve(Modules.AUTH)
    .listAuthMfa({ auth_identity_id: identity, status: "enabled" }, { select: ["id"], take: 1 })
  return factors.length > 0
}

/** Whether the signed-in person has 2FA on: their own account changes then ask its code too. */
export async function callerHasFactor(req: MedusaRequest): Promise<boolean> {
  const identity = authOf(req)?.auth_identity_id
  return identity ? hasFactor(req, identity) : false
}

/**
 * Medusa takes a TOTP code again within its step: a sign-in and a step-up
 * take it once between them. True the first time the identity gives it.
 */
async function firstUse(identity: string, code: string): Promise<boolean> {
  return firstCodeUse(sharedRateLimitStore(), keyed(`${identity}\n${code}`))
}

/** Whether the proof is the person's: their app's code (once), a recovery code, or their password. */
async function proves(
  req: MedusaRequest,
  identity: string,
  method: Method,
  secret: string
): Promise<boolean> {
  const auth = req.scope.resolve(Modules.AUTH)
  const factor = await hasFactor(req, identity)
  if (method === "password") {
    // With 2FA on, the code: a password alone is what a stolen session's owner may know
    if (factor) {
      return false
    }
    const users = req.scope.resolve(Modules.USER)
    const [user] = await users.listUsers(
      { id: authOf(req)?.actor_id ?? "" },
      { select: ["email"], take: 1 }
    )
    if (!user) {
      return false
    }
    const result = await auth
      .authenticate("emailpass", { body: { email: user.email, password: secret } })
      .catch(() => null)
    return result?.success === true && result.authIdentity?.id === identity
  }
  if (!factor) {
    return false
  }
  if (method === "totp") {
    // Only the app's six digits: another spelling of a code must not slip past the reuse check
    if (!TOTP_CODE.test(secret)) {
      return false
    }
    if (!(await firstUse(identity, secret))) {
      return false
    }
  }
  try {
    const challenge = await auth.createAuthMfaChallenge({ auth_identity_id: identity })
    await auth.verifyAuthMfaChallenge({
      id: challenge.id,
      method,
      code: secret,
      auth_identity_id: identity,
    })
    return true
  } catch {
    return false
  }
}

/**
 * The secret as sent: percent-encoded UTF-8, since a header carries Latin-1
 * only and a password may hold "ş" or "ı". Codes are trimmed; a password is
 * taken as it was typed. Null when it does not decode.
 */
function secretOf(method: string, raw: string): string | null {
  let secret: string
  try {
    secret = decodeURIComponent(raw)
  } catch {
    return null
  }
  return method === "password" ? secret : secret.trim()
}

const reject = (req: MedusaRequest, res: MedusaResponse, status: 428 | 429, message: string) => {
  rejectRequest(req, res, status, { type: "not_allowed", message: `staff.${message}` }, message)
}

/**
 * Whether the person gave too many wrong proofs (ten in a quarter of an
 * hour, thirty in a day): their proofs stop for the rest of it. One's own
 * current password counts in the same tally (security review 2026-11-06).
 */
export async function proofsLocked(identity: string): Promise<boolean> {
  return proofsLockedIn(sharedRateLimitStore(), keyed(identity))
}

/** One wrong proof more for the person: a code, a password at a step-up or a change. */
export async function countWrongProof(identity: string): Promise<void> {
  await countWrongProofIn(sharedRateLimitStore(), keyed(identity))
}

/**
 * Proving oneself again, in the request itself (F12.6, adr/0040 §3, the
 * "second verification" of adr/0027): the shop's accounts, a new API key,
 * an owner made or unmade, 2FA turned off, the full tax id. The proof
 * comes in headers (`X-Reauth-Method`: totp, recovery_code or password,
 * only without 2FA; `X-Reauth-Secret`, percent-encoded), never in the
 * body. Ten wrong proofs in a quarter of an hour, or thirty in a day, stop
 * the person's proofs for the rest of it (429). Without one, or
 * with a wrong one, the answer is 428 (`staff.reauth_required`,
 * `staff.reauth_failed`), which the panel turns into its code dialog.
 * `when` narrows it to the changes that need it.
 */
export function requireReauth(when?: When) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const identity = authOf(req)?.auth_identity_id
    if (authOf(req)?.actor_type !== "user" || !identity || (when && !(await when(req)))) {
      next()
      return
    }
    const method = req.headers["x-reauth-method"]
    const raw = req.headers["x-reauth-secret"]
    if (typeof method !== "string" || typeof raw !== "string" || raw === "") {
      reject(req, res, 428, "reauth_required")
      return
    }
    const locked = await proofsLocked(identity)
    const burst = await proofBurstExceeded(sharedRateLimitStore(), keyed(identity))
    if (locked || burst) {
      reject(req, res, 429, "reauth_locked")
      return
    }
    const secret = secretOf(method, raw)
    const ok =
      secret !== null &&
      secret !== "" &&
      (METHODS as readonly string[]).includes(method) &&
      (await proves(req, identity, method as Method, secret).catch((error: unknown) => {
        logger.warn({ event: "staff.reauth_error", err: errorSummary(error) })
        return false
      }))
    if (!ok) {
      await countWrongProof(identity)
      reject(req, res, 428, "reauth_failed")
      return
    }
    next()
  }
}

/**
 * `POST /auth/mfa/challenges/:id/verify`, a sign-in's second step, takes an
 * app code once, in the same count as a step-up (F15.1; adr/0040 §3's
 * remaining risk): a code a real-time phishing proxy relays neither signs
 * in a second time nor proves a sensitive change. Only the app's six
 * digits; Medusa takes a recovery code once itself. Runs after Medusa's
 * authentication and body validation.
 */
export async function signInCodeOnce(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const identity = authOf(req)?.auth_identity_id
    const { method, code } = (req.validatedBody ?? {}) as { method?: unknown; code?: unknown }
    if (!identity || method !== "totp") {
      next()
      return
    }
    if (typeof code !== "string" || !TOTP_CODE.test(code) || !(await firstUse(identity, code))) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "staff.mfa_code_used" },
        "mfa_code_used"
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
