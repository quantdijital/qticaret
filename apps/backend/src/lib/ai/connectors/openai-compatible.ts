import { parseRetryAfter } from "../../clients/retry"
import { aiProviderError, isRetryableAiError } from "../errors"
import type { AiErrorKey } from "../errors"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"
import { transportOf } from "../transport/own-key"
import type { ConnectorSending } from "../transport/own-key"
import type { AiTransportResponse } from "../transport/types"
import { readCompletion, registeredBodyError } from "./openai-response"
import { sendByRules, waitFor } from "./send-rules"
import type { Failure } from "./send-rules"
import { statusFailure } from "./status-failure"
import { TEXT_TIMEOUT_MS } from "./types"
import type { AiImageInput, TextConnector, TextRequest, TextResult } from "./types"

/**
 * The text and image reading connector DeepSeek, MiniMax and Gemini share (adr/0071 §2):
 * an OpenAI style chat completion. The address comes from the registry
 * alone and must be on the service's host list; redirects are refused;
 * the credential is the transport's (`lib/ai/transport`): the shop's own
 * key in the `Authorization` header and nowhere else (§9), or the
 * platform's, added by the gateway (adr/0085 §3).
 *
 * Tried again once, only when the service said it did not take the job
 * and the transport allows it (`send-rules.ts`, §8).
 */

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export { DEFAULT_RETRY_WAIT_MS, MAX_RETRY_WAIT_MS, failureOfThrown, waitFor } from "./send-rules"
export type { Failure } from "./send-rules"

export type OpenAiCompatibleOptions = {
  service: AiService
  target: OpenAiCompatibleTarget
  /** The whole call, the retry and its wait included. */
  timeoutMs?: number
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
} & ConnectorSending
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

function failureOfResponse(service: AiService, response: AiTransportResponse): Failure | null {
  const registered = registeredBodyError(service, response.body)
  const failed = registered
    ? { key: registered.key, code: `body_${String(registered.code)}` }
    : statusFailure(service, response.status, response.body)
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

/** What reading a successful answer gives: its result, or why it is none. */
export type AnswerRead<T> = { ok: true; result: T } | { ok: false; key: AiErrorKey; code: string }

/**
 * Posts one chat body to the registered address and reads the answer
 * (`read`), tried again once as §8 allows. The text and the tool calling
 * connectors (`openai-tools.ts`) share it, so both send through the same
 * transport, refuse redirects and map failures alike.
 */
export type ChatSend = <T>(
  body: string,
  read: (body: Buffer) => AnswerRead<T>,
  signal?: AbortSignal
) => Promise<T>

export function chatSender(options: OpenAiCompatibleOptions): ChatSend {
  const { service, target } = options
  const transport = transportOf(options)
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

  return async <T>(
    body: string,
    read: (body: Buffer) => AnswerRead<T>,
    outer?: AbortSignal
  ): Promise<T> => {
    const url = endpointOf(service, target)
    if (url === null) {
      throw aiProviderError({
        service: service.id,
        key: "ai.provider_response_invalid",
        code: "endpoint_not_registered",
      })
    }
    return sendByRules({
      transport,
      to: { service, target, url },
      body,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeoutMs,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      signal: outer,
      wait,
      judge: (response) => {
        const failure = failureOfResponse(service, response)
        if (failure !== null) {
          return { ok: false, failure }
        }
        const answer = read(response.body)
        return answer.ok
          ? { ok: true, result: answer.result }
          : {
              ok: false,
              failure: {
                service: service.id,
                key: answer.key,
                code: answer.code,
                retry: false,
              },
            }
      },
    })
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
