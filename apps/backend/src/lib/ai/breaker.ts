import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER } from "../clients/circuit-breaker"
import type { CircuitBreakerOptions } from "../clients/circuit-breaker"
import { aiProviderError } from "./errors"
import { failureOf } from "./outcome"
import type { AiCapability } from "./registry/capabilities"
import { PLATFORM_SERVICE_ID } from "./registry/platform-service"
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

/** A call's service and what it asks of it: the platform's credits keep a breaker per capability. */
export interface AiBreakerTarget {
  service: string
  capability: AiCapability
}

/**
 * The breaker a call runs through: the service's own, as before; on the
 * platform's credits one per capability (`platform:<capability>`), since
 * each is run by another provider behind the gateway and one unwell (the
 * image editor) must not hold back the others (the text).
 */
export function aiBreakerKeyOf(target: string | AiBreakerTarget): string {
  if (typeof target === "string") {
    return target
  }
  return target.service === PLATFORM_SERVICE_ID
    ? `${PLATFORM_SERVICE_ID}:${target.capability}`
    : target.service
}

/**
 * Runs one call through the service's breaker (`aiBreakerKeyOf`). `laterFailure` names a
 * failure the call returned instead of throwing (the one correction,
 * adr/0074 §4, made after the first call answered): the service's last
 * word, so an unwell one is recorded as the permit's failure, not its
 * success, and corrections that keep failing open the circuit.
 */
export async function withAiBreaker<T>(
  target: string | AiBreakerTarget,
  call: () => Promise<T>,
  options: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER,
  laterFailure?: (result: T) => unknown
): Promise<T> {
  const serviceId = typeof target === "string" ? target : target.service
  const breaker = breakerOf(aiBreakerKeyOf(target), options)
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
