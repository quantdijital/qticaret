/**
 * How many of a run's fetches go to the old site at once (adr/0042 Ek
 * 2026-11-20): a few while the host answers, halved each time it turns
 * one away (down to one), raised again by one after a streak of answers.
 * A wait the host asked for (`Retry-After`) holds every fetch that starts
 * before it ends. Kind to a small shared host, quick with a big one.
 *
 * Two stops keep a hostile or dead host from holding the run: a host that
 * turns away TRIP fetches in a row is given up for the run (`trippedBy`:
 * its last refusal's key), and past the run's time budget nothing more is
 * fetched (`expired`). The pictures left are named in the report and
 * fetched by a later run.
 */

/** Fetches side by side while the host answers well. */
export const PACE_MAX = 4
// Answers in a row that earn one more fetch side by side
const STREAK = 10
/** Refusals in a row from one host that give it up for the run. */
export const HOST_TRIP = 10
/** How long a run's pictures may take in all. */
export const IMAGE_BUDGET_MS = 60 * 60 * 1000

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class FetchPace {
  private limit: number
  private active = 0
  private streak = 0
  private holdUntil = 0
  private readonly waiting: (() => void)[] = []
  private readonly hosts = new Map<string, { failures: number; key: string }>()
  private readonly deadline: number

  constructor(
    private readonly max = PACE_MAX,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = pause,
    budgetMs = IMAGE_BUDGET_MS
  ) {
    this.limit = Math.max(1, max)
    this.deadline = now() + budgetMs
  }

  /** The run's time budget is spent: nothing more is fetched. */
  expired(): boolean {
    return this.now() >= this.deadline
  }

  /** The key of the refusal that gave `host` up for the run; null while it is tried. */
  trippedBy(host: string): string | null {
    const state = this.hosts.get(host)
    return state && state.failures >= HOST_TRIP ? state.key : null
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

  /** The host turned a fetch away (`key`): fewer side by side, its wait kept, counted. */
  refused(retryAfterMs: number | null = null, host?: string, key = ""): void {
    if (host !== undefined) {
      this.hosts.set(host, { failures: (this.hosts.get(host)?.failures ?? 0) + 1, key })
    }
    this.limit = Math.max(1, Math.floor(this.limit / 2))
    this.streak = 0
    if (retryAfterMs !== null && retryAfterMs > 0) {
      this.holdUntil = Math.max(this.holdUntil, this.now() + retryAfterMs)
    }
  }

  /** The host answered: its refusals forgiven; after a streak, one more side by side. */
  succeeded(host?: string): void {
    if (host !== undefined) {
      this.hosts.delete(host)
    }
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
