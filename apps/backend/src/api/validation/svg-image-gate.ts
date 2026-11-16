import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refuseSvgImages } from "../../lib/media/svg-use"

// Deep enough for a batch's products, their variants and their images
const MAX_DEPTH = 6

/**
 * The picture addresses a product write names, wherever it names them:
 * `thumbnail`, and every `images` entry (an object's `url` or a plain
 * address), in a product, a batch's creates and updates, or a variant.
 */
export function imageUrlsOf(body: unknown, depth = 0): string[] {
  if (depth > MAX_DEPTH || body === null || typeof body !== "object") {
    return []
  }
  if (Array.isArray(body)) {
    return body.flatMap((item) => imageUrlsOf(item, depth + 1))
  }
  return Object.entries(body as Record<string, unknown>).flatMap(([key, value]) => {
    if (key === "thumbnail" && typeof value === "string") {
      return [value]
    }
    if (key === "images" && Array.isArray(value)) {
      return value.flatMap((image) =>
        typeof image === "string"
          ? [image]
          : image && typeof (image as { url?: unknown }).url === "string"
            ? [(image as { url: string }).url]
            : []
      )
    }
    return imageUrlsOf(value, depth + 1)
  })
}

/**
 * A product's pictures are never SVG (the owner's SVG is for the logos and
 * the site icon, `lib/media/svg-use.ts`): Medusa's product routes, the
 * batch ones included, refuse one before they write.
 */
export async function svgImageGate(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    await refuseSvgImages(req.scope, imageUrlsOf(req.body), "images")
    next()
  } catch (error) {
    next(error)
  }
}
