/**
 * The proof of work the backend asks past a soft limit (adr/0044 §1), in
 * place of a picture puzzle: a nonce that makes SHA-256(salt + nonce)
 * start with `bits` zero bits. About 260,000 tries at the usual 18 bits.
 */
export interface Challenge {
  token: string
  salt: string
  bits: number
  expires_at: string
}

// Digests asked of the browser at once: the page is never held up for long
const BATCH = 512

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
  const encoder = new TextEncoder()
  for (let start = 0; ; start += BATCH) {
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
}

/** The header the answer goes back in: the challenge's token, then the nonce. */
export const challengeHeader = (token: string, nonce: string) => ({
  "x-challenge": `${token}.${nonce}`,
})
