/**
 * Where seen nonces of signed requests are kept (adr/0061 §3.2: a nonce
 * seen in the last 11 minutes is refused). `claim` is atomic: true for the
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

/** The part of an ioredis client the store uses: `SET key value EX ttl NX`. */
export interface NonceRedisClient {
  set: (key: string, value: string, ex: "EX", seconds: number, nx: "NX") => Promise<unknown>
}

/**
 * Seen nonces in Redis (adr/0061 §3.2, Ek C9), shared by every process: a
 * nonce replayed to another instance is refused too. `SET NX EX` claims
 * and expires in one atomic command. A Redis error is thrown, never read
 * as "unseen": the caller refuses the request (fails closed).
 */
export class RedisNonceStore implements NonceStore {
  constructor(
    private readonly redis: NonceRedisClient,
    private readonly prefix = "qt:nonce:"
  ) {}

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError("ttlSeconds must be a positive whole number")
    }
    const answer = await this.redis.set(`${this.prefix}${key}`, "1", "EX", ttlSeconds, "NX")
    return answer === "OK"
  }
}
