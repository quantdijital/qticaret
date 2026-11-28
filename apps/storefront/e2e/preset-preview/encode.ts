import type { Page } from "@playwright/test"

/** The gallery thumbnail's size (adr/0063 §7, docs/12: 800×500 WebP). */
export const OUT = { width: 800, height: 500 }
/** The loader's own limit (`PRESET_LIMITS.previewBytes`). */
export const MAX_BYTES = 256 * 1024
const QUALITIES = [0.72, 0.64, 0.56, 0.48, 0.4]

/** A PNG made smaller in the browser's own encoder: no image library needed. */
export async function toWebp(encoder: Page, png: Buffer): Promise<Buffer> {
  const src = `data:image/png;base64,${png.toString("base64")}`
  for (const quality of QUALITIES) {
    const url = await encoder.evaluate(
      async ({ src, width, height, quality }) => {
        const image = new Image()
        image.src = src
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d")
        if (!context) {
          return ""
        }
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = "high"
        context.drawImage(image, 0, 0, width, height)
        return canvas.toDataURL("image/webp", quality)
      },
      { src, ...OUT, quality }
    )
    if (!url.startsWith("data:image/webp;base64,")) {
      throw new Error("the browser did not encode WebP")
    }
    const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
    if (bytes.length <= MAX_BYTES) {
      return bytes
    }
  }
  throw new Error(`the thumbnail stays over ${String(MAX_BYTES / 1024)} KB`)
}
