export interface CircuitBreakerOptions {
  /** Consecutive failures that open the circuit. */
  failureThreshold: number
  /** How long the circuit stays open before one trial request. */
  resetAfterMs: number
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetAfterMs: 30_000,
}

export type CircuitState = "closed" | "open" | "half_open"

/**
 * Stops calling a provider that keeps failing (docs/03 F2.1). One instance
 * per client, and clients are created once per provider at module load, so
 * the state is per process. Only failures that say the provider is unwell
 * count: network errors, timeouts and 5xx, never a 4xx caused by our input.
 */
export class CircuitBreaker {
  readonly #options: CircuitBreakerOptions
  readonly #now: () => number
  #failures = 0
  #openedAt: number | null = null
  #trialInFlight = false

  constructor(options: CircuitBreakerOptions, now: () => number = Date.now) {
    this.#options = options
    this.#now = now
  }

  get state(): CircuitState {
    if (this.#openedAt === null) {
      return "closed"
    }
    return this.#now() - this.#openedAt < this.#options.resetAfterMs ? "open" : "half_open"
  }

  /**
   * A permit for one request, or null while the circuit is open. In
   * half-open state only one trial is out at a time.
   */
  acquire(): { trial: boolean } | null {
    const state = this.state
    if (state === "closed") {
      return { trial: false }
    }
    if (state === "open" || this.#trialInFlight) {
      return null
    }
    this.#trialInFlight = true
    return { trial: true }
  }

  /**
   * Gives a permit back without an outcome: the request never reached the
   * provider (a refused URL, a request we could not build). A trial that
   * recorded nothing would otherwise hold the half-open state forever.
   */
  release(permit: { trial: boolean }): void {
    if (permit.trial) {
      this.#trialInFlight = false
    }
  }

  recordSuccess(): void {
    this.#failures = 0
    this.#openedAt = null
    this.#trialInFlight = false
  }

  recordFailure(): void {
    this.#trialInFlight = false
    this.#failures += 1
    // A failed trial reopens at once
    if (this.#openedAt !== null || this.#failures >= this.#options.failureThreshold) {
      this.#openedAt = this.#now()
    }
  }
}
