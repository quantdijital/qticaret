import { parseKey } from "../../src/lib/crypto/pii"
import { parseEnv } from "../../src/lib/env"
import { issueChallenge, solveChallenge } from "../../src/lib/security/challenge"
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

/** A solved challenge as the server makes them, its key the test environment's; easy (10 bits). */
export const freshChallenge = (scope: ChallengeScope) =>
  solved(issueChallenge(scope, parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"), 10))
