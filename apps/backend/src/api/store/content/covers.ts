import type { MedusaContainer } from "@medusajs/framework/types"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"

/**
 * A cover's size and versions from its media record, as a product image's
 * (`STORE_MEDIA_LEAVES`): the theme prints `width`/`height` and a `srcset`.
 * A cover added by its URL alone, or not measured, has nulls.
 */
export interface CoverImage {
  image_width: number | null
  image_height: number | null
  image_derivatives: unknown
}

const UNKNOWN: CoverImage = { image_width: null, image_height: null, image_derivatives: null }

/** The covers' records by URL, one query for a whole page. */
export async function coversOf(
  container: Pick<MedusaContainer, "resolve">,
  urls: readonly (string | null)[]
): Promise<Map<string, CoverImage>> {
  const wanted = [...new Set(urls.filter((url): url is string => Boolean(url)))]
  if (wanted.length === 0) {
    return new Map()
  }
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets(
      { url: wanted },
      { select: ["url", "width", "height", "derivatives"], take: null }
    )
  return new Map(
    assets.map((asset) => [
      asset.url,
      {
        image_width: asset.width ?? null,
        image_height: asset.height ?? null,
        image_derivatives: asset.derivatives ?? null,
      },
    ])
  )
}

export const coverOf = (covers: Map<string, CoverImage>, url: string | null): CoverImage =>
  (url ? covers.get(url) : undefined) ?? UNKNOWN

/** A picture in a text, as the media library knows it (docs/21 2026-11-06). */
export interface BodyImage {
  url: string
  width: number | null
  height: number | null
  derivatives: unknown
}

/**
 * The pictures of a text the media library knows, with their size and
 * versions, once each: the storefront prints `width`/`height` and a
 * `srcset` for each `<img>` of the HTML whose address is here. A picture
 * at an address the library does not hold is left out (shown as it is).
 */
export async function bodyImagesOf(
  container: Pick<MedusaContainer, "resolve">,
  srcs: readonly string[]
): Promise<BodyImage[]> {
  const covers = await coversOf(container, srcs)
  return [...covers].map(([url, cover]) => ({
    url,
    width: cover.image_width,
    height: cover.image_height,
    derivatives: cover.image_derivatives,
  }))
}
