/**
 * How many of a run's fetches go to the old site at once (adr/0042 Ek
 * 2026-11-20): a few while the host answers, halved each time it turns
 * one away (down to one), raised again by one after a streak of answers.
 * A wait the host asked for (`Retry-After`) holds every fetch that starts
 * before it ends. Kind to a small shared host, quick with a big one.
 */

/** Fetches side by side while the host answers well. */
export const PACE_MAX = 4
// Answers in a row that earn one more fetch side by side
const STREAK = 10

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class FetchPace {
  private limit: number
  private active = 0
  private streak = 0
  private holdUntil = 0
  private readonly waiting: (() => void)[] = []

  constructor(
    private readonly max = PACE_MAX,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = pause
  ) {
    this.limit = Math.max(1, max)
  }

  /** Fetches allowed side by side now. */
  get current(): number {
    return this.limit
  }

  /** `work` when a place is free and any wait the host asked for is over. */
  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.enter()
    try {
      const wait = this.holdUntil - this.now()
      if (wait > 0) {
        await this.sleep(wait)
      }
      return await work()
    } finally {
      this.active -= 1
      this.admit()
    }
  }

  /** The host turned a fetch away: fewer side by side, and its wait kept. */
  refused(retryAfterMs: number | null = null): void {
    this.limit = Math.max(1, Math.floor(this.limit / 2))
    this.streak = 0
    if (retryAfterMs !== null && retryAfterMs > 0) {
      this.holdUntil = Math.max(this.holdUntil, this.now() + retryAfterMs)
    }
  }

  /** The host answered: after a streak, one more side by side. */
  succeeded(): void {
    this.streak += 1
    if (this.streak >= STREAK && this.limit < this.max) {
      this.limit += 1
      this.streak = 0
      this.admit()
    }
  }

  private enter(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => this.waiting.push(resolve))
  }

  private admit(): void {
    while (this.active < this.limit && this.waiting.length > 0) {
      this.active += 1
      this.waiting.shift()?.()
    }
  }
}
