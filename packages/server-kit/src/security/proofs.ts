import type { RateLimitStore } from "../rate-limit/store"

/**
 * The counters behind a person proving themselves again (adr/0040 §3,
 * adr/0061 §3.5): a 2FA code, a recovery code or their password at a
 * sensitive change. Each app keys the person with its own keyed hash
 * (`hashPii`) and passes its shared counter store; the rules and the keys
 * the counters live under are the same in both.
 */

/**
 * Wrong proofs a person may give: a code has a million values. Only wrong
 * ones count, so an owner setting up a dozen accounts is never stopped.
 */
export const WRONG_PROOF_LIMITS = [
  { tries: 10, windowMs: 15 * 60 * 1000, key: "quarter" },
  { tries: 30, windowMs: 24 * 60 * 60 * 1000, key: "day" },
] as const

/** Proofs checked at once are not yet counted as wrong: a minute's bound on them. */
export const PROOF_BURST = { tries: 10, windowMs: 60 * 1000 } as const

/** A code is good for its 30-second step and one either side: once is enough. */
export const USED_CODE_MS = 2 * 60 * 1000

/** An authenticator app's code: six digits, nothing else (no other spelling slips past reuse). */
export const TOTP_CODE = /^\d{6}$/

/**
 * Whether the person gave too many wrong proofs (ten in a quarter of an
 * hour, thirty in a day): their proofs stop for the rest of it.
 */
export async function proofsLocked(store: RateLimitStore, person: string): Promise<boolean> {
  const counts = await Promise.all(
    WRONG_PROOF_LIMITS.map(
      async (limit) => (await store.peek(`reauth:wrong:${limit.key}:${person}`)) >= limit.tries
    )
  )
  return counts.some(Boolean)
}

/** One wrong proof more for the person. */
export async function countWrongProof(store: RateLimitStore, person: string): Promise<void> {
  await Promise.all(
    WRONG_PROOF_LIMITS.map((limit) =>
      store.hit(`reauth:wrong:${limit.key}:${person}`, limit.windowMs)
    )
  )
}

/** Counts one proof attempt; true when the person is past a minute's bound. */
export async function proofBurstExceeded(store: RateLimitStore, person: string): Promise<boolean> {
  const burst = await store.hit(`reauth:burst:${person}`, PROOF_BURST.windowMs)
  return burst.count > PROOF_BURST.tries
}

/**
 * Medusa takes a TOTP code again within its step: a sign-in and a step-up
 * take it once between them. `codeKey` is the app's keyed hash of the
 * identity and the code; true the first time it is given.
 */
export async function firstCodeUse(store: RateLimitStore, codeKey: string): Promise<boolean> {
  const used = await store.hit(`reauth:used:${codeKey}`, USED_CODE_MS)
  return used.count === 1
}
