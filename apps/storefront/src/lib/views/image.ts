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

/** One picture with its versions; the alt text the shop wrote, else the product's name. */
export function imageView(asset: StoreMediaAsset, fallbackAlt: string): ImageView {
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
export function productImages(product: StoreProduct): ImageView[] {
  const assets = new Map((product.media_assets ?? []).map((asset) => [asset.url, asset]))
  const images = [...(product.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
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
