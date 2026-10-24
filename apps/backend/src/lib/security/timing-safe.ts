import { createHash, timingSafeEqual } from "node:crypto"

const digest = (value: string | Buffer): Buffer => createHash("sha256").update(value).digest()

/**
 * Constant-time equality for secrets (webhook signatures, tokens). Both sides
 * are hashed first, so differing lengths neither throw, as
 * `crypto.timingSafeEqual` does, nor leak through an early return. Callers
 * comparing hex digests normalise case first.
 */
export function safeEqual(actual: string | Buffer, expected: string | Buffer): boolean {
  // An empty expected value means a secret is missing; it never matches
  if (expected.length === 0) {
    return false
  }
  return timingSafeEqual(digest(actual), digest(expected))
}
