import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hashPii, parseKey } from "../../lib/crypto/pii"
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

/** Whether the request carries a good, unused solution for the scope. */
export async function challengePassed(req: MedusaRequest, scope: ChallengeScope): Promise<boolean> {
  const header = req.headers["x-challenge"]
  if (typeof header !== "string") {
    return false
  }
  const check = checkChallenge(header, scope, keyOf())
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
      if (count <= scaled.max || (await challengePassed(req, scope))) {
        next()
        return
      }
      demandChallenge(req, res, scope, bitsFor(count, scaled))
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Past `limit` failed sign-ins for one address (from anywhere), a challenge
 * first. Only failures count, and only a challenge follows, never a lock:
 * anyone may type someone's address, nobody may lock its owner out.
 */
export function challengeAfterFailures(limit: SoftLimit) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    if (req.method !== "POST" || typeof email !== "string") {
      next()
      return
    }
    try {
      const store = sharedRateLimitStore()
      const counter = `fraud:challenge:login:${hashPii(email.trim().toLowerCase(), keyOf(), "fraud.login").slice(0, 32)}`
      const failures = await store.peek(counter)
      if (failures >= limit.max && !(await challengePassed(req, "login"))) {
        demandChallenge(req, res, "login", bitsFor(failures, limit))
        return
      }
      res.on("finish", () => {
        if (res.statusCode === 401) {
          void store.hit(counter, limit.windowMs).catch(() => undefined)
        }
      })
      next()
    } catch (error) {
      next(error)
    }
  }
}
