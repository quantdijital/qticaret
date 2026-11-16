import type { Metadata } from "next"

/** The site icon as `/store/seo/site` names it (the store profile's favicon). */
export interface SiteIcon {
  favicon_url?: string | null | undefined
  /** `image/png` or `image/svg+xml` (cleaned by the backend at upload). */
  favicon_type?: string | null | undefined
  /** Apple's home screen icon: the PNG itself, or an SVG's own PNG; none when it has none. */
  apple_touch_url?: string | null | undefined
}

const TYPES = new Set(["image/png", "image/svg+xml"])

// Only what the backend would have stored: an address of its storage (http where storage is
// local: a developer's machine) or a path of its own; never a script-capable or inline one
const usable = (url: string | null | undefined): url is string => {
  const value = url?.trim() ?? ""
  return (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    (value.startsWith("/") && !value.startsWith("//"))
  )
}

/**
 * The shop's site icon as the page's `<head>` icons: the browser tab's
 * (a PNG, or an SVG with its own type) and Apple's home screen one, which
 * takes no SVG (the backend's PNG of it, or none). None chosen, or an
 * address the backend would not have stored: nothing, and `app/icon.svg`
 * stays the icon, since Next adds the file's only while the metadata names
 * no icons.
 */
export function siteIcons(icon: SiteIcon): Metadata["icons"] | undefined {
  if (!usable(icon.favicon_url)) {
    return undefined
  }
  const declared = icon.favicon_type ?? ""
  const type = TYPES.has(declared) ? declared : "image/png"
  return {
    icon: [{ url: icon.favicon_url.trim(), type }],
    ...(usable(icon.apple_touch_url) ? { apple: [{ url: icon.apple_touch_url.trim() }] } : {}),
  }
}
