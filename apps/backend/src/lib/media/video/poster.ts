import { deriveImages } from "../derive"
import type { Derivative } from "../derive"
import { sanitizeImage } from "../sanitize"

/**
 * A video's poster (adr/0069 §4 step 6): the frame ffmpeg took goes the
 * way of every product image (adr/0016), cleaned by `sanitizeImage` (a
 * JPEG, no metadata) and given its WebP/AVIF `srcset` widths and share crop
 * by `deriveImages`. Its files are named `{product-slug}-video-{n}` and
 * `{product-slug}-video-{n}-{width}` (`posterBase`, `versionName`).
 */

export interface PosterImages {
  master: { buffer: Buffer; width: number; height: number }
  derivatives: Derivative[]
}

export async function makePoster(frame: Buffer): Promise<PosterImages> {
  const master = await sanitizeImage(frame, "jpeg")
  return { master, derivatives: await deriveImages(master.buffer) }
}

/** `{slug}-video-{n}`: the base every file of the n-th video of a product is named from. */
export const videoFileBase = (slug: string, n: number): string => `${slug}-video-${String(n)}`
