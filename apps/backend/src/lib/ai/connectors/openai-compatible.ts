import { parseRetryAfter } from "../../clients/retry"
import { isSafeFetchError, safeFetch } from "../../security/safe-fetch"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { aiErrorForStatus, aiProviderError, isRetryableAiError } from "../errors"
import type { AiErrorKey, AiProviderFailure } from "../errors"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"
import { readCompletion, registeredBodyError } from "./openai-response"
import { TEXT_TIMEOUT_MS } from "./types"
import type { TextConnector, TextRequest, TextResult } from "./types"

/**
 * The text connector DeepSeek, MiniMax and Gemini share (adr/0071 §2):
 * an OpenAI style chat completion. The address comes from the registry
 * alone and must be on the service's host list; redirects are refused;
 * the key goes in the `Authorization` header and nowhere else (§9).
 *
 * Tried again once, only when the service said it did not take the job
 * (429, 5xx, no connection), after its Retry-After. A timeout or an
 * answer cut half way is never tried again: it may have been charged (§8).
 */

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
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

export interface OpenAiCompatibleOptions {
  service: AiService
  target: OpenAiCompatibleTarget
  /** Stays in this closure; never in a result or an error. */
  apiKey: string
  /** The whole call, the retry and its wait included. */
  timeoutMs?: number
  /** Tests only. */
  fetch?: typeof safeFetch
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
}

export interface Failure extends AiProviderFailure {
  retry: boolean
}

type Attempt = { ok: true; result: TextResult } | { ok: false; failure: Failure }

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

/** The registered address, or a refusal: nothing but the registry names where a call goes. */
function endpointOf(service: AiService, target: OpenAiCompatibleTarget): URL | null {
  const raw = `${target.baseUrl}${target.path}`
  if (!URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  const plain = url.search === "" && url.hash === "" && url.username === "" && url.password === ""
  return url.protocol === "https:" && plain && service.hosts.includes(url.hostname) ? url : null
}

function bodyOf(target: OpenAiCompatibleTarget, request: TextRequest): string {
  return JSON.stringify({
    ...target.body,
    model: target.model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.data },
    ],
    stream: false,
    ...(target.maxTokensField === null ? {} : { [target.maxTokensField]: request.maxTokens }),
    ...(request.json === true && target.jsonMode
      ? { response_format: { type: "json_object" } }
      : {}),
  })
}

function failureOfResponse(service: AiService, response: SafeFetchResponse): Failure | null {
  const registered = registeredBodyError(service, response.body)
  const key: AiErrorKey | null = registered?.key ?? aiErrorForStatus(response.status)
  if (key === null) {
    return null
  }
  const header = response.headers["retry-after"]
  return {
    service: service.id,
    key,
    code: registered ? `body_${String(registered.code)}` : `http_${String(response.status)}`,
    retryAfterMs: parseRetryAfter(typeof header === "string" ? header : null),
    retry: isRetryableAiError(key),
  }
}

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

export function openAiCompatibleText(options: OpenAiCompatibleOptions): TextConnector {
  const { service, target, apiKey } = options
  const send = options.fetch ?? safeFetch
  const wait = options.wait ?? waitFor
  const timeoutMs = options.timeoutMs ?? TEXT_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    // A wrong option is a bug of ours; it still leaves as the contract's error, not a RangeError
    throw aiProviderError({
      service: service.id,
      key: "ai.provider_response_invalid",
      code: "invalid_timeout",
    })
  }

  const refuse = (key: AiErrorKey, code: string) =>
    aiProviderError({ service: service.id, key, code })

  async function attempt(
    url: URL,
    body: string,
    deadline: AbortSignal,
    signal: AbortSignal
  ): Promise<Attempt> {
    let response: SafeFetchResponse
    try {
      response = await send(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
        redirect: "error",
        timeoutMs,
        maxResponseBytes: MAX_RESPONSE_BYTES,
        signal,
      })
    } catch (error) {
      return { ok: false, failure: failureOfThrown(service, error, deadline.aborted) }
    }
    const failure = failureOfResponse(service, response)
    if (failure !== null) {
      return { ok: false, failure }
    }
    const read = readCompletion(response.body)
    if (read.ok) {
      return { ok: true, result: read.result }
    }
    return {
      ok: false,
      failure: { service: service.id, key: read.key, code: read.code, retry: false },
    }
  }

  return {
    async complete(request: TextRequest): Promise<TextResult> {
      const url = endpointOf(service, target)
      if (url === null) {
        throw refuse("ai.provider_response_invalid", "endpoint_not_registered")
      }
      if (request.images !== undefined && request.images.length > 0) {
        throw refuse("ai.input_unsupported", "images_unsupported")
      }
      const deadline = AbortSignal.timeout(timeoutMs)
      const signal = request.signal ? AbortSignal.any([deadline, request.signal]) : deadline
      const body = bodyOf(target, request)

      const first = await attempt(url, body, deadline, signal)
      if (first.ok) {
        return first.result
      }
      const waitMs = first.failure.retryAfterMs ?? DEFAULT_RETRY_WAIT_MS
      if (!first.failure.retry || waitMs > MAX_RETRY_WAIT_MS) {
        throw aiProviderError(first.failure)
      }
      try {
        await wait(waitMs, signal)
      } catch {
        throw refuse("ai.timeout", deadline.aborted ? "timeout" : "aborted")
      }
      const second = await attempt(url, body, deadline, signal)
      if (second.ok) {
        return second.result
      }
      throw aiProviderError(second.failure)
    },
  }
}
