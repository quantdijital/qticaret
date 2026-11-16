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

/** An address's origin when it is an http(s) one, else null. */
function httpOrigin(address: string | null | undefined): string | null {
  if (!address || !ABSOLUTE.test(address)) {
    return null
  }
  try {
    return new URL(address).origin
  } catch {
    return null
  }
}

// Only while developing: a build's `VITE_STOREFRONT_ORIGIN` is the editor's frame, not this link
const DEV_HOME = import.meta.env.DEV ? STOREFRONT_ORIGIN : null

/**
 * Where "Mağazayı görüntüle" goes: the shop's canonical host when one is
 * set, else the address the backend says the storefront has
 * (`storefront_url` beside the SEO settings, from its own configuration),
 * else, while developing, the storefront the panel already frames. Each an
 * http(s) origin only; null when none is known (no button).
 */
export function storefrontHome(
  canonicalHost: string | null | undefined,
  served: string | null | undefined,
  fallback: string | null = DEV_HOME
): string | null {
  if (canonicalHost) {
    // A host alone: one that reads as more (a path, a user) is none
    const origin = httpOrigin(`https://${canonicalHost}`)
    return origin === `https://${canonicalHost.toLowerCase()}` ? origin : null
  }
  return httpOrigin(served) ?? httpOrigin(fallback)
}

/**
 * The address the frame and the new tab open: the storefront's origin with
 * the signed path, else the server's absolute link; null when neither is
 * known (no canonical host set and no origin configured). With `page`, the
 * storefront shows that page (a product's, a category's) with the draft
 * instead of the home page (`?sayfa=`).
 */
export function previewAddress(
  preview: Pick<LayoutPreview, "url" | "path">,
  origin: string | null = STOREFRONT_ORIGIN,
  page: string | null = null
): string | null {
  const query = page ? `?sayfa=${encodeURIComponent(page)}` : ""
  if (origin) {
    return `${origin}${preview.path}${query}`
  }
  return ABSOLUTE.test(preview.url) ? `${preview.url}${query}` : null
}
