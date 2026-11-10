import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TOTP_CODE, errorSummary } from "@qticaret/server-kit"
import { sessionIndex } from "../../lib/staff/session-index"
import { noteAuditActor } from "./audit"
import { SIGN_IN_SCOPE, codeFirstUse, countWrong, proofGate } from "./proofs"
import { loggerOf, rejectRequest } from "./request"

/**
 * A sign-in's 2FA step (Ek C4, M4). Medusa's challenge verification takes
 * a challenge id and a code, no token: which login the challenge belongs
 * to is noted here when the password step hands it out, and read back by
 * id, never from the request. Wrong codes count against that login in the
 * sign-in's own scope (ten in a quarter, thirty a day; Medusa itself caps
 * a challenge at five tries), apart from the member's sessions, so a
 * guesser with the password cannot shut their step-ups out (M2).
 */

// Medusa's challenge lifetime (mfa.challenge_ttl_seconds, default 300)
const CHALLENGE_MS = 5 * 60 * 1000

const identityOfToken = (token: unknown): string | null => {
  if (typeof token !== "string") {
    return null
  }
  try {
    const [, payload = ""] = token.split(".")
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      auth_identity_id?: unknown
    }
    return typeof claims.auth_identity_id === "string" ? claims.auth_identity_id : null
  } catch {
    return null
  }
}

/**
 * `POST /auth/user/emailpass`: when the answer is a 2FA challenge, notes
 * whose it is before the answer goes (the client verifies at once).
 */
export function noteSignInChallenge(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    const answer = body as { token?: unknown; mfa_challenge?: { id?: unknown } } | null
    const challenge = answer?.mfa_challenge?.id
    const identity = identityOfToken(answer?.token)
    if (typeof challenge !== "string" || !identity) {
      return json(body)
    }
    noteAuditActor(req, { type: "auth_identity", id: identity })
    sessionIndex()
      .noteChallenge(challenge, identity, CHALLENGE_MS)
      .catch((error: unknown) => {
        // Without the note the second step is refused: fails closed
        loggerOf(req)?.error(
          `cp.challenge_note_failed ${JSON.stringify({ err: errorSummary(error) })}`
        )
      })
      .finally(() => json(body))
    return res
  }
  next()
}

/**
 * `POST /auth/mfa/challenges/:id/verify`: the challenge's own login, not
 * locked in the sign-in scope; an app code taken once (and never again for
 * a step-up); a wrong answer counted. Runs after Medusa's validation.
 */
export async function guardSecondStep(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const challenge = (req.params as Record<string, string | undefined>)["id"] ?? ""
    const identity = await sessionIndex().challengeIdentity(challenge)
    if (!identity) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "cp.challenge_unknown" },
        "challenge_unknown"
      )
      return
    }
    noteAuditActor(req, { type: "auth_identity", id: identity })
    if (!(await proofGate(req, identity, SIGN_IN_SCOPE))) {
      rejectRequest(
        req,
        res,
        429,
        { type: "too_many_requests", message: "cp.sign_in_locked" },
        "sign_in_locked"
      )
      return
    }
    const { method, code } = (req.validatedBody ?? req.body ?? {}) as {
      method?: unknown
      code?: unknown
    }
    res.on("finish", () => {
      if (res.statusCode !== 200) {
        void countWrong(req, identity, SIGN_IN_SCOPE).catch(() => undefined)
      }
    })
    if (
      method === "totp" &&
      (typeof code !== "string" ||
        !TOTP_CODE.test(code) ||
        !(await codeFirstUse(req, identity, code)))
    ) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "cp.mfa_code_used" },
        "mfa_code_used"
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
