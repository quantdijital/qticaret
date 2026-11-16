import type { MediaAsset } from "@/features/media/api/media"

const F = "settings.store.brand.favicon"

/** The server's limits (`workflows/platform-settings/steps/favicon.ts`): a PNG, at most 1 MB. */
export const FAVICON_MIME = "image/png"
export const FAVICON_MAX_BYTES = 1024 * 1024
/** Below this a search engine does not show it (Google asks 48 px or more). */
export const FAVICON_MIN_SIDE = 48

/** Why an image cannot be the site icon (the server refuses it too), or null. */
export function faviconRefusal(asset: Pick<MediaAsset, "mime_type" | "size">): string | null {
  if (asset.mime_type !== FAVICON_MIME) {
    return `${F}.type`
  }
  if (asset.size !== null && asset.size > FAVICON_MAX_BYTES) {
    return `${F}.tooLarge`
  }
  return null
}

/** What to say of the icon's shape: a warning, never a refusal (the owner's "warn, don't block"). */
export function faviconWarnings(size: { width: number; height: number } | null): string[] {
  if (!size || size.width === 0 || size.height === 0) {
    return []
  }
  return [
    ...(size.width !== size.height ? [`${F}.notSquare`] : []),
    ...(Math.min(size.width, size.height) < FAVICON_MIN_SIDE ? [`${F}.small`] : []),
  ]
}
