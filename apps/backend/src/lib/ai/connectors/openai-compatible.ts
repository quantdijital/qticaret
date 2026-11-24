import { parseRetryAfter } from "../../clients/retry"
import { isSafeFetchError, safeFetch } from "../../security/safe-fetch"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { aiProviderError, isRetryableAiError } from "../errors"
import type { AiErrorKey, AiProviderFailure } from "../errors"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"
import { readCompletion, registeredBodyError } from "./openai-response"
import { statusFailure } from "./status-failure"
import { TEXT_TIMEOUT_MS } from "./types"
import type { AiImageInput, TextConnector, TextRequest, TextResult } from "./types"

/**
 * The text and image reading connector DeepSeek, MiniMax and Gemini share (adr/0071 §2):
 * an OpenAI style chat completion. The address comes from the registry
 * alone and must be on the service's host list; redirects are refused;
 * the key goes in the `Authorization` header and nowhere else (§9).
 *
 * Tried again once, only when the service said it did not take the job
 * (429 for a rate, 5xx, no connection), after its Retry-After. A timeout or an
 * answer cut half way is never tried again: it may have been charged (§8).
 * A used-up quota is not either: the next call fails the same way.
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

// What an image may be sent as; SVG never (it is a document, not a picture)
const IMAGE_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"])

/** Whether every image is of a type and a size the target takes. */
const imagesFit = (target: OpenAiCompatibleTarget, images: readonly AiImageInput[]): boolean =>
  target.imageInput !== undefined &&
  images.every(
    (image) =>
      IMAGE_TYPES.has(image.mimeType) &&
      image.bytes.length > 0 &&
      image.bytes.length <= (target.imageInput?.maxBytes ?? 0)
  )

/**
 * The user message: the data block alone, or, with images, the data block
 * as a text part and each image as a base64 `data:` URL (adr/0071 §9: the
 * service is never given an address of the shop's storage).
 */
function userContent(request: TextRequest): string | Record<string, unknown>[] {
  const images = request.images ?? []
  if (images.length === 0) {
    return request.data
  }
  return [
    { type: "text", text: request.data },
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}` },
    })),
  ]
}

function bodyOf(target: OpenAiCompatibleTarget, request: TextRequest): string {
  return JSON.stringify({
    ...target.body,
    model: target.model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: userContent(request) },
    ],
    stream: false,
    ...(target.maxTokensField === null ? {} : { [target.maxTokensField]: request.maxTokens }),
    // Only where the target is documented to take it; a reasoning model may refuse the field
    ...(target.temperature === true && request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
    ...(request.json === true && target.jsonMode
      ? { response_format: { type: "json_object" } }
      : {}),
  })
}

function failureOfResponse(service: AiService, response: SafeFetchResponse): Failure | null {
  const registered = registeredBodyError(service, response.body)
  const failed = registered
    ? { key: registered.key, code: `body_${String(registered.code)}` }
    : statusFailure(service, response.status, response.body)
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

/** What reading a successful answer gives: its result, or why it is none. */
export type AnswerRead<T> = { ok: true; result: T } | { ok: false; key: AiErrorKey; code: string }

/**
 * Posts one chat body to the registered address and reads the answer
 * (`read`), tried again once as §8 allows. The text and the tool calling
 * connectors (`openai-tools.ts`) share it, so both keep the key in the
 * header, refuse redirects and map failures alike.
 */
export type ChatSend = <T>(
  body: string,
  read: (body: Buffer) => AnswerRead<T>,
  signal?: AbortSignal
) => Promise<T>

export function chatSender(options: OpenAiCompatibleOptions): ChatSend {
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

  async function attempt<T>(
    url: URL,
    body: string,
    read: (body: Buffer) => AnswerRead<T>,
    deadline: AbortSignal,
    signal: AbortSignal
  ): Promise<{ ok: true; result: T } | { ok: false; failure: Failure }> {
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
      return {
        ok: false,
        failure: failureOfThrown(service, error, deadline.aborted),
      }
    }
    const failure = failureOfResponse(service, response)
    if (failure !== null) {
      return { ok: false, failure }
    }
    const answer = read(response.body)
    if (answer.ok) {
      return { ok: true, result: answer.result }
    }
    return {
      ok: false,
      failure: {
        service: service.id,
        key: answer.key,
        code: answer.code,
        retry: false,
      },
    }
  }

  return async <T>(
    body: string,
    read: (body: Buffer) => AnswerRead<T>,
    outer?: AbortSignal
  ): Promise<T> => {
    const url = endpointOf(service, target)
    if (url === null) {
      throw refuse("ai.provider_response_invalid", "endpoint_not_registered")
    }
    const deadline = AbortSignal.timeout(timeoutMs)
    const signal = outer ? AbortSignal.any([deadline, outer]) : deadline
    const first = await attempt(url, body, read, deadline, signal)
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
    const second = await attempt(url, body, read, deadline, signal)
    if (second.ok) {
      return second.result
    }
    throw aiProviderError(second.failure)
  }
}

export function openAiCompatibleText(options: OpenAiCompatibleOptions): TextConnector {
  const { service, target } = options
  const post = chatSender(options)
  const refuse = (key: AiErrorKey, code: string) =>
    aiProviderError({ service: service.id, key, code })

  return {
    async complete(request: TextRequest): Promise<TextResult> {
      if (endpointOf(service, target) === null) {
        throw refuse("ai.provider_response_invalid", "endpoint_not_registered")
      }
      // A text target takes no image; a vision target only the types and sizes it documents
      if (request.images !== undefined && request.images.length > 0) {
        if (target.imageInput === undefined) {
          throw refuse("ai.input_unsupported", "images_unsupported")
        }
        if (!imagesFit(target, request.images)) {
          throw refuse("ai.input_unsupported", "image_not_accepted")
        }
      }
      return post(bodyOf(target, request), readCompletion, request.signal)
    },
  }
}
