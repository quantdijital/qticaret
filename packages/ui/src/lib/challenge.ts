/**
 * The proof of work the backend asks past a soft limit (adr/0044 §1), in
 * place of a picture puzzle: a nonce that makes SHA-256(salt + nonce)
 * start with `bits` zero bits. About 260,000 tries at the usual 18 bits.
 * The same solver as the panel's (`apps/panel/src/lib/challenge.ts`); the
 * storefront's checkout solves it in the shopper's browser.
 */
export interface Challenge {
  token: string
  salt: string
  bits: number
  expires_at: string
}

// Digests asked of the browser at once: the page is never held up for long
const BATCH = 512
// The server never asks more (adr/0044 §1); a harder one, or a run past
// sixteen times the expected tries, is given up rather than spun on
const MAX_BITS = 24
const MAX_TRIES = 2 ** (MAX_BITS + 4)

/** Whether the digest starts with `bits` zero bits. */
export function startsWithZeros(digest: Uint8Array, bits: number): boolean {
  const whole = Math.floor(bits / 8)
  for (let index = 0; index < whole; index++) {
    if (digest[index] !== 0) {
      return false
    }
  }
  const rest = bits % 8
  return rest === 0 || (digest[whole] ?? 0xff) >> (8 - rest) === 0
}

/** The nonce that answers the challenge, found with the browser's own SHA-256. */
export async function solveChallenge(challenge: Pick<Challenge, "salt" | "bits">): Promise<string> {
  if (!Number.isInteger(challenge.bits) || challenge.bits < 1 || challenge.bits > MAX_BITS) {
    throw new Error("challenge: difficulty out of range")
  }
  const limit = Math.min(MAX_TRIES, 2 ** (challenge.bits + 4))
  const encoder = new TextEncoder()
  for (let start = 0; start < limit; start += BATCH) {
    const digests = await Promise.all(
      Array.from({ length: BATCH }, (_, offset) =>
        crypto.subtle.digest(
          "SHA-256",
          encoder.encode(`${challenge.salt}${String(start + offset)}`)
        )
      )
    )
    const found = digests.findIndex((digest) =>
      startsWithZeros(new Uint8Array(digest), challenge.bits)
    )
    if (found >= 0) {
      return String(start + found)
    }
  }
  throw new Error("challenge: no answer found")
}

/** The answer as the backend reads it (`X-Challenge`): the challenge's token, then the nonce. */
export const challengeAnswer = (token: string, nonce: string) => `${token}.${nonce}`
