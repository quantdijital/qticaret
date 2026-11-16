import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../errors"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { SVG_MIME } from "./svg"

/**
 * Where an SVG may stand (the owner, 2026-11-16): the shop's logos and its
 * site icon only. Everywhere else a picture goes (a product, a category, a
 * collection, a page's cover, the share image, a design's slide) it is
 * refused here, by what the server knows of it (its library record, or an
 * address that names an `.svg`), never by a flag the panel sends.
 */
export const SVG_ELSEWHERE = "media.svg_logo_only"

/** Whether an address names an SVG file by its path (`…/logo.svg?v=2`). */
export function namesSvg(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? ""
  return /\.svgz?$/i.test(path)
}

/** Refuses these addresses (under `field`) when one is an SVG: in the library or by its name. */
export async function refuseSvgImages(
  container: Pick<MedusaContainer, "resolve">,
  urls: readonly (string | null | undefined)[],
  field: string
): Promise<void> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))]
  if (unique.length === 0) {
    return
  }
  if (unique.some(namesSvg)) {
    throw new ValidationError(SVG_ELSEWHERE, { field })
  }
  const svg = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url: unique, mime_type: SVG_MIME }, { select: ["id"], take: 1 })
  if (svg.length > 0) {
    throw new ValidationError(SVG_ELSEWHERE, { field })
  }
}
