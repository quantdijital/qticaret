import { isProviderError } from "../../errors/errors"
import { isSafeFetchError } from "../../security/safe-fetch"
import { aiProviderError } from "../errors"
import type { AiErrorKey, AiProviderFailure } from "../errors"
import type { AiService } from "../registry/services"
import type { AiTransport, AiTransportResponse, AiTransportTarget } from "../transport/types"

/**
 * One request of a connector through its transport, under adr/0071 §8:
 * tried again once, only when the service said it did not take the job
 * (429 for a rate, 5xx, no connection), after its Retry-After, and only
 * where the transport allows a second send (never on credits). A timeout
 * or an answer cut half way is never tried again: it may have been
 * charged. A used-up quota is not either: the next call fails the same way.
 */

export const DEFAULT_RETRY_WAIT_MS = 1_000
/** A longer Retry-After is not waited for; the error carries it instead. */
export const MAX_RETRY_WAIT_MS = 10_000

// The request never reached the service: safe to send again
const NEVER_CONNECTED: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
])

export interface Failure extends AiProviderFailure {
  retry: boolean
}

// What a service says of the shop's own account: its key, its balance, its quota
const OWN_ACCOUNT_KEYS: ReadonlySet<AiErrorKey> = new Set([
  "ai.key_rejected",
  "ai.provider_balance",
  "ai.provider_quota",
])

/**
 * A failure as the shop is told it, by who pays (adr/0085 §3). On the
 * platform's credits the account behind the call is the platform's: "check
 * your key" or "your service has no balance" would point the shop at an
 * account it does not have, so these read "platform credits unavailable"
 * (the code stays, for the logs). The shop's own key: as the service said.
 */
export function fundedFailure<F extends AiProviderFailure>(transport: AiTransport, failure: F): F {
  return transport.funding === "platform_credit" && OWN_ACCOUNT_KEYS.has(failure.key)
    ? { ...failure, key: "ai.platform_unavailable" }
    : failure
}

export const waitFor = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new Error("aborted"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })

/** A failure before any answer. Only its kind is kept: the thrown error may quote the request. */
export function failureOfThrown(service: AiService, error: unknown, timedOut: boolean): Failure {
  const fail = (key: AiErrorKey, code: string, retry = false): Failure => ({
    service: service.id,
    key,
    code,
    retry,
  })
  if (timedOut) {
    return fail("ai.timeout", "timeout")
  }
  if (!isSafeFetchError(error)) {
    return fail("ai.provider_response_invalid", "unexpected")
  }
  const { reason } = error
  if (reason === "timeout" || reason === "aborted") {
    return fail("ai.timeout", reason)
  }
  if (reason === "dns_failed") {
    return fail("ai.provider_unavailable", reason, true)
  }
  if (reason === "request_failed") {
    const cause = (error as { cause?: { code?: unknown } | null }).cause
    const code = typeof cause?.code === "string" ? cause.code : ""
    // `connect_failed`: the request never left, so nothing could be charged for it
    return NEVER_CONNECTED.has(code)
      ? fail("ai.provider_unavailable", "connect_failed", true)
      : fail("ai.provider_unavailable", reason)
  }
  // A refused address, a redirect, an answer too large: not what the registry describes
  return fail("ai.provider_response_invalid", reason)
}

/** What an answer gave: the connector's result, or why it is none. */
export type Judged<T> = { ok: true; result: T } | { ok: false; failure: Failure }

export interface RuledSend<T> {
  transport: AiTransport
  to: AiTransportTarget
  body: string | Buffer
  headers: Readonly<Record<string, string>>
  /** The whole call, the retry and its wait included. */
  timeoutMs: number
  maxResponseBytes: number
  signal?: AbortSignal | undefined
  wait: (ms: number, signal: AbortSignal) => Promise<void>
  judge: (response: AiTransportResponse) => Judged<T>
}

export async function sendByRules<T>(call: RuledSend<T>): Promise<T> {
  const { service } = call.to
  const deadline = AbortSignal.timeout(call.timeoutMs)
  const signal = call.signal ? AbortSignal.any([deadline, call.signal]) : deadline

  const attempt = async (): Promise<Judged<T>> => {
    let response: AiTransportResponse
    try {
      response = await call.transport.send({
        to: call.to,
        method: "POST",
        body: call.body,
        headers: call.headers,
        timeoutMs: call.timeoutMs,
        maxResponseBytes: call.maxResponseBytes,
        signal,
      })
    } catch (error) {
      // The transport's own refusal carries our key already (the platform's, a host off the list)
      if (isProviderError(error)) {
        // This call's own deadline reaches the transport as its signal let go: a timeout (P4a D1)
        if (
          deadline.aborted &&
          error.safeMessage === "ai.timeout" &&
          error.providerCode === "aborted"
        ) {
          throw aiProviderError({ service: error.provider, key: "ai.timeout", code: "timeout" })
        }
        throw error as Error
      }
      return { ok: false, failure: failureOfThrown(service, error, deadline.aborted) }
    }
    return call.judge(response)
  }

  const first = await attempt()
  if (first.ok) {
    return first.result
  }
  const waitMs = first.failure.retryAfterMs ?? DEFAULT_RETRY_WAIT_MS
  if (!call.transport.retries || !first.failure.retry || waitMs > MAX_RETRY_WAIT_MS) {
    throw aiProviderError(fundedFailure(call.transport, first.failure))
  }
  try {
    await call.wait(waitMs, signal)
  } catch {
    throw aiProviderError({
      service: service.id,
      key: "ai.timeout",
      code: deadline.aborted ? "timeout" : "aborted",
    })
  }
  const second = await attempt()
  if (second.ok) {
    return second.result
  }
  throw aiProviderError(fundedFailure(call.transport, second.failure))
}
