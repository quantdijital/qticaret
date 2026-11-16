/**
 * When each identity's password last changed, as `sign-in-epoch.ts` read
 * it (seconds, or null for never), held a few seconds so a busy shopper's
 * requests do not each read the identity. A change made in this process
 * forgets its entry at once (`forgetPasswordChange`).
 */

const CACHE_MS = 5_000
const CACHE_ENTRIES = 5_000

const cached = new Map<string, { until: number; at: number | null }>()

/** What was read for the identity, while it holds; undefined to read again. */
export function heldPasswordChange(
  identityId: string,
  now = Date.now()
): number | null | undefined {
  const held = cached.get(identityId)
  return held && held.until > now ? held.at : undefined
}

export function holdPasswordChange(identityId: string, at: number | null, now = Date.now()): void {
  if (cached.size >= CACHE_ENTRIES) {
    cached.clear()
  }
  cached.set(identityId, { until: now + CACHE_MS, at })
}

/** Forgets what was read of the identity: its password just changed in this process. */
export function forgetPasswordChange(identityId: string): void {
  cached.delete(identityId)
}
