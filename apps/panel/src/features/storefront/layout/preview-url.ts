import type { LayoutPreview } from "@/features/storefront/api/layout"

const configured = import.meta.env.VITE_STOREFRONT_ORIGIN?.trim()

/**
 * Where the storefront runs, for the preview frame: `VITE_STOREFRONT_ORIGIN`,
 * else the storefront's dev server while developing; none in a build
 * without it, where the link the server signs (on the shop's canonical
 * host) is used as it is.
 */
export const STOREFRONT_ORIGIN: string | null = configured
  ? configured.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://localhost:8000"
    : null

const ABSOLUTE = /^https?:\/\//

/**
 * The address the frame and the new tab open: the storefront's origin with
 * the signed path, else the server's absolute link; null when neither is
 * known (no canonical host set and no origin configured).
 */
export function previewAddress(
  preview: Pick<LayoutPreview, "url" | "path">,
  origin: string | null = STOREFRONT_ORIGIN
): string | null {
  if (origin) {
    return `${origin}${preview.path}`
  }
  return ABSOLUTE.test(preview.url) ? preview.url : null
}
