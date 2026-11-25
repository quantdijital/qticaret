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
        throw error
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
    throw aiProviderError(first.failure)
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
  throw aiProviderError(second.failure)
}
