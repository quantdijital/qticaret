import { parseKey } from "@qticaret/server-kit"
import { parseEnv } from "../../src/lib/env"
import { BASE_BITS, issueChallenge, solveChallenge } from "../../src/lib/security/challenge"
import type { ChallengeScope } from "../../src/lib/security/challenge"

export interface GivenChallenge {
  token: string
  salt: string
  bits: number
}

/** The header a browser sends with its answer to a challenge (adr/0044 §1). */
export function solved(challenge: GivenChallenge | undefined): { "x-challenge": string } {
  if (!challenge) {
    throw new Error("no challenge was given")
  }
  return { "x-challenge": `${challenge.token}.${solveChallenge(challenge.salt, challenge.bits)}` }
}

/**
 * A solved challenge as the server makes them, its key the test
 * environment's; as hard as the server asks first (it refuses an easier
 * one than it asks), or `bits`.
 */
export const freshChallenge = (scope: ChallengeScope, bits = BASE_BITS) =>
  solved(issueChallenge(scope, parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"), bits))

/**
 * Turnstile (adr/0044 Ek 2026-11-24): every test request carries the dummy
 * token by default (integration-tests/setup.js); this header sends none.
 */
export const NO_TURNSTILE = { "x-turnstile-token": "" }
