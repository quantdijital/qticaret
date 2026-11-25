import { maxImagesOf } from "./limits"
import { BodyRefused, checkInlineImage, isRecord } from "./body-shared"
import type { BodyInput, RebuiltBody } from "./body-shared"

/**
 * A Gemini picture body (`generateContent`) rebuilt from an allow-list
 * (security review of P3b C1): only `contents`, each turn's parts only a
 * text or an inline picture (`inline_data` / `inlineData`: a PNG, JPEG or
 * WebP as base64, limits.ts `AI_INLINE_IMAGE_TYPES`), and the target's
 * fixed `generationConfig` (an image asked for alone) with the gateway's
 * one candidate written last, over whatever the shop sent (third review
 * D1: no table row writes over `contents` or `candidateCount`). A part
 * naming a file or a function is refused; `generation_config`,
 * `systemInstruction`, `tools`, `cachedContent`, `safetySettings`, `model`
 * and any other field are dropped. The model is the address's.
 */

/** The paths a Gemini picture body's gateway writes itself, last (D1). */
export const GEMINI_GATEWAY_FIELDS: readonly string[] = [
  "contents",
  "generationConfig.candidateCount",
]

interface Pictures {
  count: number
  bytes: number
}

const string = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new BodyRefused("part_refused")
  }
  return value
}

/** The inline picture kept in the spelling the shop used (REST takes either). */
function inlineOf(part: Record<string, unknown>, pictures: Pictures): Record<string, unknown> {
  const snake = "inline_data" in part
  const data: unknown = snake ? part["inline_data"] : part["inlineData"]
  if (!isRecord(data)) {
    throw new BodyRefused("part_refused")
  }
  const bytes = string(data["data"])
  const mimeType = string(snake ? data["mime_type"] : data["mimeType"])
  // A picture's type and base64 only: the bytes left off the text are a picture's (N1)
  checkInlineImage(mimeType, bytes)
  pictures.count += 1
  pictures.bytes += bytes.length
  return snake
    ? { inline_data: { mime_type: mimeType, data: bytes } }
    : { inlineData: { mimeType, data: bytes } }
}

function partOf(part: unknown, pictures: Pictures): Record<string, unknown> {
  if (!isRecord(part)) {
    throw new BodyRefused("part_refused")
  }
  if ("file_data" in part || "fileData" in part) {
    throw new BodyRefused("image_not_inline")
  }
  if ("inline_data" in part || "inlineData" in part) {
    return inlineOf(part, pictures)
  }
  if ("text" in part) {
    return { text: string(part["text"]) }
  }
  throw new BodyRefused("part_refused")
}

function turnOf(turn: unknown, pictures: Pictures): Record<string, unknown> {
  const parts: unknown = isRecord(turn) ? turn["parts"] : undefined
  if (!isRecord(turn) || !Array.isArray(parts) || parts.length === 0) {
    throw new BodyRefused("contents_refused")
  }
  const role = turn["role"]
  if (role !== undefined && role !== "user") {
    throw new BodyRefused("contents_refused")
  }
  return {
    ...(role === undefined ? {} : { role }),
    parts: parts.map((part) => partOf(part, pictures)),
  }
}

export function geminiImageBody(body: Record<string, unknown>, input: BodyInput): RebuiltBody {
  const contents = body["contents"]
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new BodyRefused("contents_refused")
  }
  const pictures: Pictures = { count: 0, bytes: 0 }
  // The target's fixed fields over every field the shop sent; the gateway's own last (D1)
  const fixed = input.target.fixedBody
  const fixedConfig = isRecord(fixed["generationConfig"]) ? fixed["generationConfig"] : {}
  const rebuilt = {
    ...fixed,
    contents: contents.map((turn) => turnOf(turn, pictures)),
    generationConfig: { ...fixedConfig, candidateCount: 1 },
  }
  if (pictures.count > maxImagesOf(input.task, input.capability)) {
    throw new BodyRefused("too_many_images")
  }
  return { body: rebuilt, images: pictures.count, imageBytes: pictures.bytes }
}
