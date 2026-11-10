/**
 * Where seen nonces of signed requests are kept (adr/0061 §3.2: a nonce
 * seen in the last 10 minutes is refused). `claim` is atomic: true for the
 * first caller only, as Redis `SET key 1 NX EX ttl` answers.
 */
export interface NonceStore {
  claim(key: string, ttlSeconds: number): Promise<boolean>
}

const SWEEP_EVERY = 1000

/** One process only: tests and a single-instance development server. */
export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>()
  private claims = 0

  constructor(private readonly now: () => number = Date.now) {}

  claim(key: string, ttlSeconds: number): Promise<boolean> {
    const now = this.now()
    if (++this.claims % SWEEP_EVERY === 0) {
      this.sweep(now)
    }
    const expiresAt = this.seen.get(key)
    if (expiresAt !== undefined && expiresAt > now) {
      return Promise.resolve(false)
    }
    this.seen.set(key, now + ttlSeconds * 1000)
    return Promise.resolve(true)
  }

  private sweep(now: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) {
        this.seen.delete(key)
      }
    }
  }
}
