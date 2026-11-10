import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { parseEnv } from "../../lib/env"
import { BASE_BITS, checkChallenge, issueChallenge } from "../../lib/security/challenge"
import { perIpScale } from "../../lib/security/rate-limit"
import type { ChallengeScope } from "../../lib/security/challenge"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"
import { rejectRequest } from "./reject"

/**
 * The proof of work a visitor gives past a soft limit (F15.6, adr/0044 §1):
 * below it nothing is asked; above it the answer is 428
 * `fraud.challenge_required` with a challenge in the body, and the same
 * request with `X-Challenge: <token>.<nonce>` goes through. Each solution
 * counts once. The hard limits stay the rate limiter's.
 */

let key: Buffer | undefined
const keyOf = () => (key ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"))

export interface SoftLimit {
  max: number
  windowMs: number
}

/** Whether the request carries a good, unused solution for the scope, as hard as `minBits` at least. */
export async function challengePassed(
  req: MedusaRequest,
  scope: ChallengeScope,
  minBits?: number
): Promise<boolean> {
  const header = req.headers["x-challenge"]
  if (typeof header !== "string") {
    return false
  }
  const check = checkChallenge(header, scope, keyOf(), Date.now(), minBits)
  if (!check.ok) {
    return false
  }
  // Once: its salt is kept until the challenge lapses
  const used = await sharedRateLimitStore().hit(
    `fraud:challenge:used:${check.key}`,
    Math.max(1000, check.until - Date.now())
  )
  return used.count === 1
}

/** 428 with a new challenge; harder once the visitor is far past the limit. */
export function demandChallenge(
  req: MedusaRequest,
  res: MedusaResponse,
  scope: ChallengeScope,
  bits: number = BASE_BITS
): void {
  rejectRequest(
    req,
    res,
    428,
    {
      type: "not_allowed",
      message: "fraud.challenge_required",
      challenge: issueChallenge(scope, keyOf(), bits),
    },
    "challenge_required"
  )
}

const bitsFor = (count: number, limit: SoftLimit) =>
  count > 2 * limit.max ? BASE_BITS + 2 : BASE_BITS

/**
 * Past `limit` requests from one address in the scope, a challenge first.
 * Per-address, so scaled as the rate limits are in integration tests.
 */
export function challengeOver(scope: ChallengeScope, limit: SoftLimit) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.method !== "POST") {
      next()
      return
    }
    try {
      const scaled = { ...limit, max: limit.max * perIpScale() }
      const { count } = await sharedRateLimitStore().hit(
        `fraud:challenge:${scope}:${clientBucket(req)}`,
        limit.windowMs
      )
      const bits = bitsFor(count, scaled)
      if (count <= scaled.max || (await challengePassed(req, scope, bits))) {
        next()
        return
      }
      demandChallenge(req, res, scope, bits)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Past `limit` sign-in attempts for one address (from anywhere), a
 * challenge first. Each attempt is counted before it runs, so attempts
 * sent at once cannot all slip under the limit (security review
 * 2026-10-31). Only a challenge follows, never a lock: anyone may type
 * someone's address, nobody may lock its owner out. A shopper's and a
 * staff member's sign-ins are apart (`scope`), each counted and asked
 * on its own.
 */
export function challengeAfterAttempts(
  limit: SoftLimit,
  scope: Extract<ChallengeScope, "login" | "staff_login"> = "login"
) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    if (req.method !== "POST" || typeof email !== "string") {
      next()
      return
    }
    try {
      const counter = `fraud:challenge:${scope}:${hashPii(email.trim().toLowerCase(), keyOf(), "fraud.login").slice(0, 32)}`
      const { count } = await sharedRateLimitStore().hit(counter, limit.windowMs)
      const bits = bitsFor(count, limit)
      if (count > limit.max && !(await challengePassed(req, scope, bits))) {
        demandChallenge(req, res, scope, bits)
        return
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
