import { SVG_MIME } from "@/features/media/api/media"
import type { MediaAsset } from "@/features/media/api/media"

const F = "settings.store.brand.favicon"

/**
 * The server's limits (`workflows/platform-settings/steps/favicon.ts`): a
 * PNG of at most 1 MB, or an SVG (cleaned at upload) of at most 100 KB.
 */
export const FAVICON_MIME = "image/png"
export const FAVICON_MAX_BYTES = 1024 * 1024
export const FAVICON_SVG_MAX_BYTES = 100 * 1024
/** Below this a search engine does not show it (Google asks 48 px or more). */
export const FAVICON_MIN_SIDE = 48

/** Whether the icon's address is an SVG (the server names stored SVGs `….svg`). */
export const isSvgIcon = (url: string): boolean => /\.svg$/i.test(url.split(/[?#]/)[0] ?? "")

/** Why an image cannot be the site icon (the server refuses it too), or null. */
export function faviconRefusal(asset: Pick<MediaAsset, "mime_type" | "size">): string | null {
  if (asset.mime_type !== FAVICON_MIME && asset.mime_type !== SVG_MIME) {
    return `${F}.type`
  }
  // A record that never measured its file proves no limit (the server refuses it too)
  if (asset.size === null) {
    return `${F}.unmeasured`
  }
  const limit = asset.mime_type === SVG_MIME ? FAVICON_SVG_MAX_BYTES : FAVICON_MAX_BYTES
  if (asset.size > limit) {
    return `${F}.tooLarge`
  }
  return null
}

/**
 * What to say of the icon's shape: a warning, never a refusal (the owner's
 * "warn, don't block"). An SVG's shape is its box (the server writes its
 * width and height from its `viewBox`); it draws sharp at any size, so it
 * is never too small.
 */
export function faviconWarnings(
  size: { width: number; height: number } | null,
  svg = false
): string[] {
  if (!size || size.width === 0 || size.height === 0) {
    return []
  }
  return [
    ...(size.width !== size.height ? [`${F}.notSquare`] : []),
    ...(!svg && Math.min(size.width, size.height) < FAVICON_MIN_SIDE ? [`${F}.small`] : []),
  ]
}
