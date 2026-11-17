import type { ProductVideoView } from "@qticaret/ui"
import type { StoreMediaVideo, StoreProduct } from "@qticaret/types"
import { imageView } from "./image"

/** The most a product shows (adr/0069 §1: two per product, uploads and YouTube together). */
export const MAX_PRODUCT_VIDEOS = 2

/** Where a video sits without a usable place: after the first picture (adr/0069 §2). */
const FIRST_AFTER = 1

const placeOf = (video: StoreMediaVideo): number =>
  typeof video.position === "number" && Number.isFinite(video.position)
    ? Math.max(FIRST_AFTER, Math.trunc(video.position))
    : FIRST_AFTER

const sizeOf = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null

/**
 * Whether an address may be played or shown: HTTPS, and plain HTTP in
 * development (the local storage), as the policy's `media-src` and
 * `img-src` allow (`lib/security/csp.ts`). Anything else (a relative
 * path, `data:`, `javascript:`, a malformed one) is not a clip of ours.
 */
function webAddress(url: string, development: boolean): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === "https:" || (development && protocol === "http:")
  } catch {
    return false
  }
}

/** One clip as the gallery draws it; null when it has nothing to play or no poster to show. */
function clipView(
  video: StoreMediaVideo,
  productTitle: string,
  development: boolean
): ProductVideoView | null {
  const mp4 = video.outputs?.mp4?.url
  const webm = video.outputs?.webm?.url
  const poster = video.poster
  if (!mp4 || !poster?.url) {
    return null
  }
  // Defence in depth: every address the gallery loads is a web one, or the clip is left out
  const addresses = [mp4, poster.url, ...(webm ? [webm] : [])]
  if (!addresses.every((url) => webAddress(url, development))) {
    return null
  }
  const own = video.title?.trim() ?? ""
  const title = own.length > 0 ? own : productTitle
  const duration = sizeOf(video.duration_ms)
  return {
    id: video.id,
    after: placeOf(video),
    title,
    // The poster is a picture of ours: its versions as the product's images give theirs
    poster: imageView(
      {
        url: poster.url,
        alt: title,
        width: sizeOf(poster.width),
        height: sizeOf(poster.height),
        derivatives: poster.derivatives,
      },
      title
    ),
    width: sizeOf(video.width),
    height: sizeOf(video.height),
    durationSeconds: duration === null ? null : duration / 1000,
    sources: { webm: webm && webm.length > 0 ? webm : null, mp4 },
  }
}

/**
 * The product's videos for its gallery (adr/0069 §6): the ready clips, by
 * their place, at most two. The backend already sends only the ready ones
 * (and none while the shop's videos are off); a YouTube video waits for
 * slice 5, so none is shown yet. `development` decides as the policy does
 * (`NODE_ENV`): plain HTTP addresses only then.
 */
export function productVideos(
  product: StoreProduct,
  development: boolean = process.env.NODE_ENV === "development"
): ProductVideoView[] {
  const ready = (product.media_videos ?? []).filter(
    (video): video is StoreMediaVideo =>
      Boolean(video) && video.status === "ready" && video.kind === "upload"
  )
  return ready
    .map((video, order) => ({ video, order }))
    .sort((a, b) => placeOf(a.video) - placeOf(b.video) || a.order - b.order)
    .flatMap(({ video }) => {
      const view = clipView(video, product.title, development)
      return view ? [view] : []
    })
    .slice(0, MAX_PRODUCT_VIDEOS)
}
