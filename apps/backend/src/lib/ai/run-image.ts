import sharp from "sharp"
import { isValidationError } from "../errors"
import { prepareImage } from "../media"
import type { PreparedImage } from "../media"
import { MAX_INPUT_PIXELS } from "../media/sanitize"
import { UPLOAD_MEDIA_TYPES, readImageInfo } from "../security/upload"
import type { AiSource } from "../media/ai-source"
import type { ImageEditConnector, ImageEditResult } from "./connectors/image-types"
import type { AiImageInput, AiUsage } from "./connectors/types"
import { MAX_RESULT_BYTES, downloadResult } from "./download"
import { VISION_ENCODE_TIMEOUT_SECONDS } from "./image-input"
import type { DownloadOptions } from "./download"
import { aiProviderError } from "./errors"
import { laidOnWhite } from "./on-white"
import type { AiService, ImageBackground } from "./registry/services"

/**
 * One background edit (Aşama 4, adr/0071 §9, §10): the shop's picture
 * goes out as a copy (its stored bytes are never touched), the result
 * comes back as bytes or from a listed host, and is checked and cleaned
 * exactly as an upload is (a JPEG, PNG, WebP or AVIF by its bytes, within
 * the size and pixel limits; SVG and anything else refused), then marked
 * `compositeWithTrainedAlgorithmicMedia`. A result the check refuses is
 * the service's fault: `ai.provider_response_invalid`.
 */

export interface RunImageEdit {
  connector: ImageEditConnector
  service: AiService
  /** The original's stored bytes; read, never written. */
  original: Buffer
  /** The name the result is stored under, before its extension. */
  name: string
  background: ImageBackground
  signal?: AbortSignal | undefined
  /** Tests only. */
  download?: DownloadOptions["fetch"]
}

export interface ImageEditDone {
  image: PreparedImage
  usage: AiUsage
}

/** What is sent: the picture as it is, or a PNG copy where the services read no AVIF. */
export async function imageInputOf(service: AiService, original: Buffer): Promise<AiImageInput> {
  const type = readImageInfo(original)?.type
  if (type === undefined) {
    throw aiProviderError({
      service: service.id,
      key: "ai.input_unsupported",
      code: "not_a_raster_image",
    })
  }
  if (type === "avif") {
    const bytes = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .png()
      // The AI path's encode limit (lib/ai/image-input.ts)
      .timeout({ seconds: VISION_ENCODE_TIMEOUT_SECONDS })
      .toBuffer()
    return { mimeType: "image/png", bytes }
  }
  return { mimeType: UPLOAD_MEDIA_TYPES[type].mime, bytes: original }
}

/** Failures raised after the service answered, with what it counted: the call is paid for. */
const answeredCalls = new WeakMap<object, AiUsage>()

/**
 * The usage of a call the service answered before the failure (the
 * result's download or check refused it); null: it never answered. The
 * usage row still counts the image so the cost is recorded.
 */
export function answeredUsageOf(error: unknown): AiUsage | null {
  return typeof error === "object" && error !== null ? (answeredCalls.get(error) ?? null) : null
}

/** A service's result fetched where it is an address, checked as an upload, marked `source`. */
async function keptResult(
  run: Pick<RunImageEdit, "service" | "name" | "signal" | "download">,
  result: ImageEditResult,
  source: AiSource
): Promise<ImageEditDone> {
  try {
    return await checkedResult(run, result, source)
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      answeredCalls.set(error, result.usage)
    }
    throw error
  }
}

async function checkedResult(
  run: Pick<RunImageEdit, "service" | "name" | "signal" | "download">,
  result: ImageEditResult,
  source: AiSource
): Promise<ImageEditDone> {
  const { service } = run
  const invalid = (code: string) =>
    aiProviderError({ service: service.id, key: "ai.provider_response_invalid", code })
  const fetched =
    result.kind === "url"
      ? await downloadResult(service, result.url, { signal: run.signal, fetch: run.download })
      : result.bytes
  if (fetched.length === 0 || fetched.length > MAX_RESULT_BYTES) {
    throw invalid("result_size")
  }
  const bytes = result.onWhite ? await laidOnWhite(service, fetched) : fetched
  try {
    const prepared = await prepareImage(bytes, `${run.name}.png`, "image", { aiSource: source })
    return { image: prepared, usage: result.usage }
  } catch (error) {
    if (isValidationError(error)) {
      // `upload.*`: what the check said, never the bytes
      throw invalid(`result_${error.safeMessage}`)
    }
    throw error
  }
}

export async function runImageEdit(run: RunImageEdit): Promise<ImageEditDone> {
  const image = await imageInputOf(run.service, run.original)
  const result = await run.connector.edit({
    image,
    background: run.background,
    ...(run.signal ? { signal: run.signal } : {}),
  })
  return keptResult(run, result, "edited")
}

export interface RunImageScene extends Omit<RunImageEdit, "background"> {
  /** The scene's description, from the shop's sector pack (lib/ai/scenes.ts). */
  setting: string
  /** What the service's scene endpoint is recorded to make (`ImageSceneTarget.source`). */
  source: AiSource
}

/**
 * One scene (Aşama 7): as `runImageEdit`, the original sent as a copy and
 * the result checked and cleaned as an upload, then marked as the
 * service's scene endpoint is recorded: `compositeWithTrainedAlgorithmicMedia`
 * (`edited`) or `trainedAlgorithmicMedia` (`generated`).
 */
export async function runImageScene(run: RunImageScene): Promise<ImageEditDone> {
  const scene = run.connector.scene
  if (!scene) {
    throw aiProviderError({
      service: run.service.id,
      key: "ai.service_unavailable",
      code: "scene_unsupported",
    })
  }
  const image = await imageInputOf(run.service, run.original)
  const result = await scene({
    image,
    setting: run.setting,
    ...(run.signal ? { signal: run.signal } : {}),
  })
  return keptResult(run, result, run.source)
}
