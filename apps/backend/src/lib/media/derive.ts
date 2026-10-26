import { readImage } from "./sanitize"

/**
 * The versions a product image is served in (docs/13 §8, adr/0016): WebP
 * and AVIF at the widths of a `srcset` (none wider than the image itself),
 * and a 1200×630 JPEG cropped around what draws the eye, for sharing.
 */

export const SRCSET_WIDTHS: readonly number[] = [400, 800, 1600]
export const SRCSET_FORMATS = ["webp", "avif"] as const
export type SrcsetFormat = (typeof SRCSET_FORMATS)[number]
export const OG_SIZE = { width: 1200, height: 630 } as const

export interface Derivative {
  kind: "srcset" | "og"
  format: SrcsetFormat | "jpeg"
  width: number
  height: number
  buffer: Buffer
}

/** The widths for an image this wide: the standard ones below it, and its own up to the largest. */
export function srcsetWidths(width: number): number[] {
  const below = SRCSET_WIDTHS.filter((each) => each < width)
  const own = Math.min(width, SRCSET_WIDTHS[SRCSET_WIDTHS.length - 1] ?? width)
  return below.includes(own) ? below : [...below, own]
}

const EXTENSIONS = { webp: "webp", avif: "avif", jpeg: "jpg" } as const

/** `{slug}-{position}-{width}.webp`, `{slug}-{position}-og.jpg`: names that say what the picture is. */
export const derivativeName = (slug: string, position: number, derivative: Derivative): string =>
  `${slug}-${String(position)}-${derivative.kind === "og" ? "og" : String(derivative.width)}.${EXTENSIONS[derivative.format]}`

// Upright first: a master stored before the cleaning (an import) may carry an orientation
const upright = (master: Buffer) => readImage(master).rotate()

export async function deriveImages(master: Buffer): Promise<Derivative[]> {
  const { info } = await upright(master).toBuffer({ resolveWithObject: true })
  const width = info.width
  const derivatives: Derivative[] = []
  for (const target of srcsetWidths(width)) {
    for (const format of SRCSET_FORMATS) {
      const resized = upright(master).resize({ width: target, withoutEnlargement: true })
      const encoded =
        format === "webp" ? resized.webp({ quality: 80 }) : resized.avif({ quality: 50 })
      const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
      derivatives.push({
        kind: "srcset",
        format,
        width: info.width,
        height: info.height,
        buffer: data,
      })
    }
  }
  // JPEG has no transparency: a cut-out product sits on white, not black
  const og = await upright(master)
    .resize({ ...OG_SIZE, fit: "cover", position: "attention" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  derivatives.push({
    kind: "og",
    format: "jpeg",
    width: og.info.width,
    height: og.info.height,
    buffer: og.data,
  })
  return derivatives
}
