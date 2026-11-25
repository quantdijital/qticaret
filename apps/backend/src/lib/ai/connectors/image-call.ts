import { parseRetryAfter } from "../../clients/retry"
import { aiProviderError, isRetryableAiError } from "../errors"
import type { AiService, ImageEditTarget } from "../registry/services"
import { onServiceHosts } from "../transport/own-key"
import type { AiTransport, AiTransportResponse } from "../transport/types"
import { sendByRules, waitFor } from "./send-rules"
import type { Failure } from "./send-rules"
import { statusFailure } from "./status-failure"

/**
 * One POST to an image endpoint under the text connector's rules
 * (adr/0071 §8, §9): the registry's address on the service's host list,
 * redirects refused, the credential the transport's, tried again once
 * only when the service said it did not take the job (429 for a rate,
 * 5xx, no connection) and the transport allows it, never after a timeout
 * or a used-up quota. Gives back a 2xx answer; any other end is a
 * `ProviderError` with our key and code alone.
 */

export interface ImageCall {
  service: AiService
  target: ImageEditTarget
  /** From the registry: the target's own address or its scene's. */
  url: string
  /** The body's type and what is accepted; no credential. */
  headers: Readonly<Record<string, string>>
  body: Buffer | string
  timeoutMs: number
  maxResponseBytes: number
  signal?: AbortSignal | undefined
  transport: AiTransport
  /** Tests only. */
  wait?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined
}

/** The registered address, or null: nothing but the registry names where a call goes. */
export function registeredEndpoint(service: AiService, raw: string): URL | null {
  if (!URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  return onServiceHosts(service, url) ? url : null
}

function failureOfStatus(service: AiService, response: AiTransportResponse): Failure | null {
  const failed = statusFailure(service, response.status, response.body)
  if (failed === null) {
    return null
  }
  const { key, code } = failed
  return {
    service: service.id,
    key,
    code,
    retryAfterMs: parseRetryAfter(response.headers["retry-after"] ?? null),
    retry: isRetryableAiError(key),
  }
}

export async function postImageCall(call: ImageCall): Promise<AiTransportResponse> {
  const { service } = call
  const url = registeredEndpoint(service, call.url)
  if (url === null) {
    throw aiProviderError({
      service: service.id,
      key: "ai.provider_response_invalid",
      code: "endpoint_not_registered",
    })
  }
  return sendByRules({
    transport: call.transport,
    to: { service, target: call.target, url },
    body: call.body,
    headers: call.headers,
    timeoutMs: call.timeoutMs,
    maxResponseBytes: call.maxResponseBytes,
    signal: call.signal,
    wait: call.wait ?? waitFor,
    judge: (response) => {
      const failure = failureOfStatus(service, response)
      return failure === null ? { ok: true, result: response } : { ok: false, failure }
    },
  })
}
