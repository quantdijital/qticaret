import { BodyRefused, checkInlineImage, isRecord } from "./body-shared"
import type { BodyInput, RebuiltBody } from "./body-shared"

/**
 * A Bria body (v2 image editing: Remove Background, Replace Background)
 * rebuilt from an allow-list, as Gemini's is (body-gemini.ts): `image`,
 * the picture as base64 alone (never an address: Bria would fetch it, and
 * our storage's addresses are never given out), and, for a scene alone, a
 * `prompt` (the shop's scene description), both written last. The target's
 * fixed fields stand in for anything else: `sync: true` (the gateway
 * reads no status address), the pinned cut-out model, the scene's `fibo2`
 * mode and size. Every other field is dropped: `webhook_url` (an address
 * Bria would post to), `ref_images` (pictures by address), `seed`,
 * `negative_prompt`, a cut-out's `prompt` (priced higher by Bria) and any
 * other.
 */

/** The paths a Bria body's gateway writes itself (`fixedBody` aside). */
export const BRIA_GATEWAY_FIELDS: readonly string[] = ["image", "prompt"]

// The longest scene description the shop sends, with its fixed words around it, and room
const MAX_PROMPT_CHARS = 2_000

/** A picture's type read from its first bytes (the base64 of 12 bytes is 16 characters). */
function sniffedType(data: string): string | null {
  const head = Buffer.from(data.slice(0, 16), "base64")
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "image/png"
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

function imageOf(value: unknown): string {
  if (typeof value !== "string") {
    throw new BodyRefused("image_refused")
  }
  const type = sniffedType(value)
  if (type === null) {
    // An address, a data URL's head or anything not a PNG, JPEG or WebP
    throw new BodyRefused("image_type_refused")
  }
  checkInlineImage(type, value)
  return value
}

function promptOf(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > MAX_PROMPT_CHARS) {
    throw new BodyRefused("prompt_refused")
  }
  return value
}

export function briaBody(body: Record<string, unknown>, input: BodyInput): RebuiltBody {
  const image = imageOf(body["image"])
  const scene = input.task === "image_scene"
  const fixed = isRecord(input.target.fixedBody) ? input.target.fixedBody : {}
  // The fixed fields over every field the shop sent (it sent none but these two); the
  // picture and the scene's words last, so no table row writes over them (D1)
  const rebuilt = {
    ...fixed,
    image,
    ...(scene ? { prompt: promptOf(body["prompt"]) } : {}),
  }
  return { body: rebuilt, images: 1, imageBytes: image.length }
}
