import { parseRetryAfter } from "../../clients/retry"
import { safeFetch } from "../../security/safe-fetch"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { aiProviderError, isRetryableAiError } from "../errors"
import type { AiService } from "../registry/services"
import {
  DEFAULT_RETRY_WAIT_MS,
  MAX_RETRY_WAIT_MS,
  failureOfThrown,
  waitFor,
} from "./openai-compatible"
import type { Failure } from "./openai-compatible"
import { statusFailure } from "./status-failure"

/**
 * One POST to an image endpoint under the text connector's rules
 * (adr/0071 §8, §9): the registry's address on the service's host list,
 * redirects refused, the key in a header only, tried again once only
 * when the service said it did not take the job (429 for a rate, 5xx, no
 * connection), never after a timeout or a used-up quota. Gives back a 2xx answer; any other
 * end is a `ProviderError` with our key and code alone.
 */

export interface ImageCall {
  service: AiService
  /** From the registry. */
  url: string
  headers: Readonly<Record<string, string>>
  body: Buffer | string
  timeoutMs: number
  maxResponseBytes: number
  signal?: AbortSignal | undefined
  /** Tests only. */
  fetch?: typeof safeFetch | undefined
  wait?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined
}

/** The registered address, or null: nothing but the registry names where a call goes. */
export function registeredEndpoint(service: AiService, raw: string): URL | null {
  if (!URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  const plain = url.search === "" && url.hash === "" && url.username === "" && url.password === ""
  return url.protocol === "https:" && plain && service.hosts.includes(url.hostname) ? url : null
}

function failureOfStatus(service: AiService, response: SafeFetchResponse): Failure | null {
  const failed = statusFailure(service, response.status, response.body)
  if (failed === null) {
    return null
  }
  const { key, code } = failed
  const header = response.headers["retry-after"]
  return {
    service: service.id,
    key,
    code,
    retryAfterMs: parseRetryAfter(typeof header === "string" ? header : null),
    retry: isRetryableAiError(key),
  }
}

export async function postImageCall(call: ImageCall): Promise<SafeFetchResponse> {
  const { service } = call
  const url = registeredEndpoint(service, call.url)
  if (url === null) {
    throw aiProviderError({
      service: service.id,
      key: "ai.provider_response_invalid",
      code: "endpoint_not_registered",
    })
  }
  const send = call.fetch ?? safeFetch
  const wait = call.wait ?? waitFor
  const deadline = AbortSignal.timeout(call.timeoutMs)
  const signal = call.signal ? AbortSignal.any([deadline, call.signal]) : deadline

  const attempt = async (): Promise<SafeFetchResponse | Failure> => {
    try {
      const response = await send(url, {
        method: "POST",
        headers: call.headers,
        body: call.body,
        redirect: "error",
        timeoutMs: call.timeoutMs,
        maxResponseBytes: call.maxResponseBytes,
        signal,
      })
      return failureOfStatus(service, response) ?? response
    } catch (error) {
      return failureOfThrown(service, error, deadline.aborted)
    }
  }
  const isFailure = (value: SafeFetchResponse | Failure): value is Failure => "key" in value

  const first = await attempt()
  if (!isFailure(first)) {
    return first
  }
  const waitMs = first.retryAfterMs ?? DEFAULT_RETRY_WAIT_MS
  if (!first.retry || waitMs > MAX_RETRY_WAIT_MS) {
    throw aiProviderError(first)
  }
  try {
    await wait(waitMs, signal)
  } catch {
    throw aiProviderError({
      service: service.id,
      key: "ai.timeout",
      code: deadline.aborted ? "timeout" : "aborted",
    })
  }
  const second = await attempt()
  if (!isFailure(second)) {
    return second
  }
  throw aiProviderError(second)
}
