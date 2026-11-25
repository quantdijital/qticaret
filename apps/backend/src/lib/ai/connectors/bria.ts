import { aiProviderError } from "../errors"
import type { AiService, ImageEditTarget } from "../registry/services"
import { transportOf } from "../transport/own-key"
import type { ConnectorSending } from "../transport/own-key"
import type { AiTransportResponse } from "../transport/types"
import { postImageCall } from "./image-call"
import { IMAGE_TIMEOUT_MS } from "./image-types"
import type {
  ImageEditConnector,
  ImageEditRequest,
  ImageEditResult,
  ImageSceneRequest,
} from "./image-types"

/**
 * Bria's v2 image editing (the record and its pages:
 * `lib/ai/registry/service-bria.ts`). JSON with the picture as base64 in
 * `image` (never an address of our storage) and the endpoint's fixed
 * fields from the shared table (`sync: true`: one call, no status address
 * read); the key in `api_token`, the transport's. A cut-out is Remove
 * Background; a scene Replace Background in `fibo2` mode with the scene's
 * description as `prompt`. The answer names the result by its address
 * (`result.image_url`), fetched only from the service's download hosts
 * (`run-image.ts`). Bria makes no white background: the cut-out is asked
 * for and marked to be laid on white once fetched (`onWhite`).
 */

// The answer is a small JSON naming the result; an error body is a few kilobytes
const MAX_RESPONSE_BYTES = 256 * 1024

const BRIA_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"])

export type BriaOptions = {
  service: AiService
  target: ImageEditTarget
  timeoutMs?: number
  /** Tests only. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
} & ConnectorSending

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The result's address from a synchronous answer; anything else is no answer we read. */
export function readBriaAnswer(service: AiService, response: AiTransportResponse): string {
  const invalid = (code: string) =>
    aiProviderError({ service: service.id, key: "ai.provider_response_invalid", code })
  // 202: the job was queued, not done (`sync` was not honoured); no status address is read
  if (response.status !== 200) {
    throw invalid(`http_${String(response.status)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(response.body.toString("utf8"))
  } catch {
    throw invalid("not_json")
  }
  const result = isRecord(parsed) ? parsed["result"] : undefined
  const url = isRecord(result) ? result["image_url"] : undefined
  if (typeof url !== "string" || url === "") {
    throw invalid("no_image")
  }
  return url
}

export function briaImageEdit(options: BriaOptions): ImageEditConnector {
  const { service, target } = options
  const transport = transportOf(options)
  const call = async (
    url: string,
    fields: Readonly<Record<string, unknown>>,
    image: ImageEditRequest["image"],
    signal: AbortSignal | undefined
  ): Promise<string> => {
    if (!BRIA_TYPES.has(image.mimeType)) {
      throw aiProviderError({
        service: service.id,
        key: "ai.input_unsupported",
        code: "image_type_unsupported",
      })
    }
    const response = await postImageCall({
      service,
      target,
      url,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // The picture and the words first, the endpoint's fixed fields last (as the gateway)
      body: JSON.stringify({ image: image.bytes.toString("base64"), ...fields }),
      timeoutMs: options.timeoutMs ?? IMAGE_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      signal,
      transport,
      wait: options.wait,
    })
    return readBriaAnswer(service, response)
  }
  const sceneTarget = target.scene
  return {
    async edit(request: ImageEditRequest): Promise<ImageEditResult> {
      if (!target.backgrounds.includes(request.background)) {
        throw aiProviderError({
          service: service.id,
          key: "ai.input_unsupported",
          code: "background_unsupported",
        })
      }
      const url = await call(target.url, target.body ?? {}, request.image, request.signal)
      return {
        kind: "url",
        url,
        usage: {},
        ...(request.background === "white" ? { onWhite: true as const } : {}),
      }
    },
    ...(sceneTarget
      ? {
          scene: async (request: ImageSceneRequest): Promise<ImageEditResult> => {
            const fields = { prompt: request.setting, ...(sceneTarget.body ?? {}) }
            const url = await call(sceneTarget.url, fields, request.image, request.signal)
            return { kind: "url", url, usage: {} }
          },
        }
      : {}),
  }
}
