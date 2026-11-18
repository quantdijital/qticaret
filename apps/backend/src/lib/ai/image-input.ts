import type { Readable } from "node:stream"
import { readImage } from "../media"
import { readImageInfo } from "../security/upload"
import type { AiImageInput } from "./connectors/types"
import { aiProviderError } from "./errors"

/**
 * An image as it goes to an image reading service (adr/0071 §9, §10):
 * read from the shop's own storage on the server, never sent as an
 * address. The type is told from the bytes, never from a name or a
 * stored MIME type; only JPEG, PNG and WebP (and AVIF, re-encoded) are
 * read, SVG never. It leaves as a JPEG of at most 1024 px a side with
 * no metadata block: enough to describe a product, a fraction of the
 * tokens, and well under every service's limit.
 */

/** A stored image larger than this is not read at all. */
export const VISION_SOURCE_MAX_BYTES = 20 * 1024 * 1024
/** The longest side sent. */
export const VISION_MAX_SIDE = 1024
/** What is sent at most, after re-encoding. */
export const VISION_MAX_BYTES = 4 * 1024 * 1024

export const VISION_MIME = "image/jpeg"
/** How long re-encoding may take: a crafted file cannot hold the worker (lib/media/svg-raster.ts). */
export const VISION_ENCODE_TIMEOUT_SECONDS = 10

const refuse = (service: string, code: string) =>
  aiProviderError({ service, key: "ai.input_unsupported", code })

/**
 * A stored file read from its download stream, stopped as soon as it
 * passes `VISION_SOURCE_MAX_BYTES` (null then): a large file is never
 * held whole in memory (the brand logo's way, workflows/brands/logo-size.ts).
 */
export async function readVisionSource(stream: Readable): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const chunk of stream) {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
      total += part.length
      if (total > VISION_SOURCE_MAX_BYTES) {
        return null
      }
      chunks.push(part)
    }
  } finally {
    stream.destroy()
  }
  return Buffer.concat(chunks, total)
}

/**
 * The image re-encoded for the call; `ai.input_unsupported` for anything
 * not an accepted picture, too large, or unreadable.
 */
export async function visionImage(bytes: Buffer, service: string): Promise<AiImageInput> {
  if (bytes.length === 0 || bytes.length > VISION_SOURCE_MAX_BYTES) {
    return Promise.reject(refuse(service, "image_size"))
  }
  if (readImageInfo(bytes) === null) {
    return Promise.reject(refuse(service, "image_type"))
  }
  let encoded: Buffer
  try {
    encoded = await readImage(bytes)
      .rotate()
      .resize({
        width: VISION_MAX_SIDE,
        height: VISION_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      // A transparent PNG reads as a picture on white, as a shop shows it
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .timeout({ seconds: VISION_ENCODE_TIMEOUT_SECONDS })
      .toBuffer()
  } catch {
    throw refuse(service, "image_unreadable")
  }
  if (encoded.length > VISION_MAX_BYTES) {
    throw refuse(service, "image_size")
  }
  return { mimeType: VISION_MIME, bytes: encoded }
}
