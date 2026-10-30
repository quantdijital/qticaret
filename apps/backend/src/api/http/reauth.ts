import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { errorSummary, logger } from "../../lib/logging"
import { sharedRateLimitStore } from "./rate-limit"
import { rejectRequest } from "./reject"

const METHODS = ["totp", "recovery_code", "password"] as const
type Method = (typeof METHODS)[number]

// Wrong proofs a person may give: a code has a million values. Only wrong
// ones count, so an owner setting up a dozen accounts is never stopped
const WRONG = [
  { tries: 10, windowMs: 15 * 60 * 1000, key: "quarter" },
  { tries: 30, windowMs: 24 * 60 * 60 * 1000, key: "day" },
] as const
// Proofs checked at once are not yet counted as wrong: a minute's bound on them
const BURST = { tries: 10, windowMs: 60 * 1000 }
// A code is good for its 30-second step and one either side: once is enough
const USED_CODE_MS = 2 * 60 * 1000
const TOTP_CODE = /^\d{6}$/

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
    // Medusa takes a TOTP code again within its step: a step-up takes it once
    const used = await sharedRateLimitStore().hit(
      `reauth:used:${keyed(`${identity}\n${secret}`)}`,
      USED_CODE_MS
    )
    if (used.count > 1) {
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
    const store = sharedRateLimitStore()
    const person = keyed(identity)
    const wrongSoFar = await Promise.all(
      WRONG.map(
        async (limit) => (await store.peek(`reauth:wrong:${limit.key}:${person}`)) >= limit.tries
      )
    )
    const burst = await store.hit(`reauth:burst:${person}`, BURST.windowMs)
    if (wrongSoFar.some(Boolean) || burst.count > BURST.tries) {
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
      await Promise.all(
        WRONG.map((limit) => store.hit(`reauth:wrong:${limit.key}:${person}`, limit.windowMs))
      )
      reject(req, res, 428, "reauth_failed")
      return
    }
    next()
  }
}
