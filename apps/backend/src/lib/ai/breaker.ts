import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER } from "../clients/circuit-breaker"
import type { CircuitBreakerOptions } from "../clients/circuit-breaker"
import { aiProviderError } from "./errors"
import { failureOf } from "./outcome"
import { registerProcessCache } from "../cache/process-caches"

/**
 * A circuit breaker per AI service (adr/0071 §8), as `lib/clients/http-client.ts`
 * keeps one per provider: a service that keeps failing is not called for
 * a while, and the panel hears `ai.provider_unavailable` at once. State is
 * per process. Only failures that say the service is unwell count (no
 * connection, 5xx, a timeout); a refused key, an empty balance or a busy
 * answer say the service is there.
 */

const breakers = new Map<string, CircuitBreaker>()
// Every AI service starts closed per spec file of a bundled test run
registerProcessCache(() => {
  breakers.clear()
})

function breakerOf(serviceId: string, options: CircuitBreakerOptions): CircuitBreaker {
  let breaker = breakers.get(serviceId)
  if (!breaker) {
    breaker = new CircuitBreaker(options)
    breakers.set(serviceId, breaker)
  }
  return breaker
}

/** Tests only: every service starts closed. */
export const resetAiBreakers = (): void => {
  breakers.clear()
}

/** A text or card task's correction that failed, as `withAiBreaker`'s `laterFailure` reads it. */
export const correctionFailure = (result: {
  correction: { status: string; error?: unknown } | null
}): unknown => (result.correction?.status === "failed" ? result.correction.error : null)

/**
 * Runs one call through the service's breaker. `laterFailure` names a
 * failure the call returned instead of throwing (the one correction,
 * adr/0074 §4, made after the first call answered): the service's last
 * word, so an unwell one is recorded as the permit's failure, not its
 * success, and corrections that keep failing open the circuit.
 */
export async function withAiBreaker<T>(
  serviceId: string,
  call: () => Promise<T>,
  options: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER,
  laterFailure?: (result: T) => unknown
): Promise<T> {
  const breaker = breakerOf(serviceId, options)
  const permit = breaker.acquire()
  if (!permit) {
    throw aiProviderError({
      service: serviceId,
      key: "ai.provider_unavailable",
      code: "circuit_open",
    })
  }
  try {
    const result = await call()
    const later = laterFailure?.(result)
    if (later !== undefined && later !== null && failureOf(later).unwell) {
      breaker.recordFailure()
    } else {
      breaker.recordSuccess()
    }
    return result
  } catch (error) {
    const failure = failureOf(error)
    if (failure.unwell) {
      breaker.recordFailure()
    } else if (failure.answered) {
      breaker.recordSuccess()
    } else {
      breaker.release(permit)
    }
    throw error
  }
}
