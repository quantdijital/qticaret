import type { safeFetch } from "../../security/safe-fetch"
import { aiProviderError } from "../errors"
import type { AiErrorKey } from "../errors"
import type { AiService, ImageBackground, ImageEditTarget } from "../registry/services"
import { postImageCall } from "./image-call"
import { IMAGE_TIMEOUT_MS } from "./image-types"
import type { ImageEditConnector, ImageEditRequest, ImageEditResult } from "./image-types"

/**
 * Gemini's image editing (Aşama 4; the record and its pages:
 * `lib/ai/registry/services.ts`): `generateContent` with the picture as
 * `inline_data` and a fixed instruction, an image asked for alone. The
 * key in `x-goog-api-key`, never in the address. The answer's image is
 * base64 in `inlineData`; never an address. Nothing typed by anyone goes
 * in the instruction (adr/0071 §2).
 */

// The decoded image is held to an upload's size later; base64 is a third larger
const MAX_RESPONSE_BYTES = 30 * 1024 * 1024

const INSTRUCTIONS: Readonly<Record<ImageBackground, string>> = {
  white:
    "Replace the background of this product photo with a plain, pure white (#FFFFFF) " +
    "background. Keep the product exactly as it is: the same shape, colours, text, labels, " +
    "proportions and position. Do not add, remove or change anything on the product. " +
    "No props, no text, no frame.",
  transparent: "",
}

const BLOCKED: ReadonlySet<string> = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
])

export interface GeminiImageOptions {
  service: AiService
  target: ImageEditTarget
  /** Stays in this closure; never in a result or an error. */
  apiKey: string
  timeoutMs?: number
  /** Tests only. */
  fetch?: typeof safeFetch
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const countOf = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined

type Read = { ok: true; result: ImageEditResult } | { ok: false; key: AiErrorKey; code: string }

/** The first image part of the first candidate; a block or no image is a failure. */
export function readGeminiImage(body: Buffer): Read {
  let parsed: unknown
  try {
    parsed = JSON.parse(body.toString("utf8"))
  } catch {
    return { ok: false, key: "ai.provider_response_invalid", code: "not_json" }
  }
  if (!isRecord(parsed)) {
    return { ok: false, key: "ai.provider_response_invalid", code: "not_an_object" }
  }
  const feedback = parsed["promptFeedback"]
  if (isRecord(feedback) && typeof feedback["blockReason"] === "string") {
    return { ok: false, key: "ai.content_blocked", code: "prompt_blocked" }
  }
  const candidates = parsed["candidates"]
  const first: unknown = Array.isArray(candidates) ? candidates[0] : undefined
  if (!isRecord(first)) {
    return { ok: false, key: "ai.provider_response_invalid", code: "no_candidate" }
  }
  const finish = first["finishReason"]
  if (typeof finish === "string" && BLOCKED.has(finish)) {
    return { ok: false, key: "ai.content_blocked", code: "finish_blocked" }
  }
  const content = first["content"]
  const parts: unknown = isRecord(content) ? content["parts"] : undefined
  const image = (Array.isArray(parts) ? parts : [])
    .map((part: unknown) =>
      isRecord(part) ? (part["inlineData"] ?? part["inline_data"]) : undefined
    )
    .find(
      (data): data is Record<string, unknown> => isRecord(data) && typeof data["data"] === "string"
    )
  if (image === undefined) {
    return { ok: false, key: "ai.provider_response_invalid", code: "no_image" }
  }
  const usage = isRecord(parsed["usageMetadata"]) ? parsed["usageMetadata"] : {}
  const inputTokens = countOf(usage["promptTokenCount"])
  const outputTokens = countOf(usage["candidatesTokenCount"])
  return {
    ok: true,
    result: {
      kind: "bytes",
      bytes: Buffer.from(image["data"] as string, "base64"),
      usage: {
        ...(inputTokens === undefined ? {} : { inputTokens }),
        ...(outputTokens === undefined ? {} : { outputTokens }),
      },
    },
  }
}

export function geminiImageEdit(options: GeminiImageOptions): ImageEditConnector {
  const { service, target, apiKey } = options
  return {
    async edit(request: ImageEditRequest): Promise<ImageEditResult> {
      const instruction = INSTRUCTIONS[request.background]
      if (!target.backgrounds.includes(request.background) || instruction === "") {
        throw aiProviderError({
          service: service.id,
          key: "ai.input_unsupported",
          code: "background_unsupported",
        })
      }
      const body = JSON.stringify({
        contents: [
          {
            parts: [
              { text: instruction },
              {
                inline_data: {
                  mime_type: request.image.mimeType,
                  data: request.image.bytes.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE"] },
      })
      const response = await postImageCall({
        service,
        url: target.url,
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
        timeoutMs: options.timeoutMs ?? IMAGE_TIMEOUT_MS,
        maxResponseBytes: MAX_RESPONSE_BYTES,
        signal: request.signal,
        fetch: options.fetch,
        wait: options.wait,
      })
      const read = readGeminiImage(response.body)
      if (!read.ok) {
        throw aiProviderError({ service: service.id, key: read.key, code: read.code })
      }
      return read.result
    },
  }
}
