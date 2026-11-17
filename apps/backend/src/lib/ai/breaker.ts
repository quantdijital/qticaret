import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER } from "../clients/circuit-breaker"
import type { CircuitBreakerOptions } from "../clients/circuit-breaker"
import { aiProviderError } from "./errors"
import { failureOf } from "./outcome"

/**
 * A circuit breaker per AI service (adr/0071 §8), as `lib/clients/http-client.ts`
 * keeps one per provider: a service that keeps failing is not called for
 * a while, and the panel hears `ai.provider_unavailable` at once. State is
 * per process. Only failures that say the service is unwell count (no
 * connection, 5xx, a timeout); a refused key, an empty balance or a busy
 * answer say the service is there.
 */

const breakers = new Map<string, CircuitBreaker>()

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

/** Runs one call through the service's breaker. */
export async function withAiBreaker<T>(
  serviceId: string,
  call: () => Promise<T>,
  options: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER
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
    breaker.recordSuccess()
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
