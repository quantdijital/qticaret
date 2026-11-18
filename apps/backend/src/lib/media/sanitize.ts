import sharp from "sharp"
import type { Sharp } from "sharp"
import type { ImageType } from "../security/upload"
import { DIGITAL_SOURCE_TYPES, digitalSourceTypeOf, digitalSourceXmp } from "./ai-source"
import type { AiSource } from "./ai-source"

/**
 * What an uploaded image becomes before it is stored (docs/04, F3.3,
 * adr/0016): turned upright by its EXIF orientation, every metadata block
 * dropped (EXIF with GPS, XMP, IPTC, comments), colours in sRGB, at most
 * 2560 px a side, re-encoded in its own format. No copy with metadata is
 * kept anywhere. One value alone is written back: the IPTC
 * DigitalSourceType of an AI made picture (lib/media/ai-source.ts).
 */

export const MASTER_MAX_SIDE = 2560
// The upload check's own limit (S5): a second guard against decompression bombs
export const MAX_INPUT_PIXELS = 40_000_000

const ENCODERS: Record<ImageType, (image: Sharp) => Sharp> = {
  jpeg: (image) => image.jpeg({ quality: 86, mozjpeg: true }),
  png: (image) => image.png({ compressionLevel: 9 }),
  webp: (image) => image.webp({ quality: 86 }),
  // Upload answers wait for this; a low effort keeps an AVIF to well under a second
  avif: (image) => image.avif({ quality: 60, effort: 2 }),
}

export interface CleanImage {
  buffer: Buffer
  width: number
  height: number
}

/** Reads only the first frame of an animation: product images are stills. */
export const readImage = (buffer: Buffer): Sharp =>
  sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })

export interface SanitizeOptions {
  /** An AI service made it (adr/0071 §10): marked so, whatever the bytes said. */
  aiSource?: AiSource | undefined
}

/**
 * The one mark the clean copy keeps: ours when an AI service made it,
 * else the file's own AI term (an upload a tool marked), else none.
 */
async function markOf(buffer: Buffer, options: SanitizeOptions): Promise<string | null> {
  if (options.aiSource) {
    return DIGITAL_SOURCE_TYPES[options.aiSource]
  }
  return digitalSourceTypeOf((await readImage(buffer).metadata()).xmp)
}

export async function sanitizeImage(
  buffer: Buffer,
  type: ImageType,
  options: SanitizeOptions = {}
): Promise<CleanImage> {
  const mark = await markOf(buffer, options)
  const resized = readImage(buffer).rotate().resize({
    width: MASTER_MAX_SIDE,
    height: MASTER_MAX_SIDE,
    fit: "inside",
    withoutEnlargement: true,
  })
  // Every block the file brought is dropped first; only this packet is written
  const image = mark === null ? resized : resized.withXmp(digitalSourceXmp(mark))
  const { data, info } = await ENCODERS[type](image).toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height }
}
