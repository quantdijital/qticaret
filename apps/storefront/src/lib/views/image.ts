import type { ImageView } from "@qticaret/ui"
import type { MediaDerivatives, StoreMediaAsset, StoreProduct } from "@qticaret/types"

const srcset = (entries: { width: number; url: string }[] | undefined): string | null =>
  entries && entries.length > 0
    ? [...entries]
        .sort((a, b) => a.width - b.width)
        .map((entry) => `${entry.url} ${String(entry.width)}w`)
        .join(", ")
    : null

function sourcesOf(derivatives: MediaDerivatives | null): ImageView["sources"] {
  return {
    avif: srcset(derivatives?.srcset?.avif),
    webp: srcset(derivatives?.srcset?.webp),
  }
}

/** One picture with its versions; the alt text the shop wrote, else the given name. */
export function imageView(
  asset: Pick<StoreMediaAsset, "url" | "alt" | "width" | "height" | "derivatives">,
  fallbackAlt: string
): ImageView {
  return {
    src: asset.url,
    alt: asset.alt?.trim() ? asset.alt : fallbackAlt,
    width: asset.width,
    height: asset.height,
    sources: sourcesOf(asset.derivatives),
  }
}

/**
 * The product's pictures in its own order (Medusa's images by rank), each
 * with its media record when it has one (alt text, sizes, versions); an
 * image added by URL alone has none and is shown as it is.
 */
/** The product's images by rank: `productImages` and `variantImages` count places alike. */
const ranked = (product: StoreProduct) =>
  [...(product.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

export function productImages(product: StoreProduct): ImageView[] {
  const assets = new Map((product.media_assets ?? []).map((asset) => [asset.url, asset]))
  const images = ranked(product)
  const urls =
    images.length > 0
      ? images.map((image) => image.url)
      : product.thumbnail
        ? [product.thumbnail]
        : []
  return urls.map((url) => {
    const asset = assets.get(url)
    return asset
      ? imageView(asset, product.title)
      : {
          src: url,
          alt: product.title,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
  })
}

/**
 * Each variant's own pictures (Medusa's variant images) as places in
 * `productImages`, by variant id, in the pictures' order; a variant with
 * none of its own is left out.
 */
export function variantImages(product: StoreProduct): Map<string, number[]> {
  const places = new Map<string, number[]>()
  for (const [place, image] of ranked(product).entries()) {
    for (const variant of image.variants ?? []) {
      if (variant) {
        places.set(variant.id, [...(places.get(variant.id) ?? []), place])
      }
    }
  }
  return places
}
