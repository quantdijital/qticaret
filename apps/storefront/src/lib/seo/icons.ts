import type { Metadata } from "next"

/**
 * The shop's site icon (the store profile's favicon, a PNG from its media
 * library) as the page's `<head>` icons: the browser tab's and Apple's
 * home screen one. None, or an address the backend would not have stored
 * (not https, not a path): nothing, and `app/icon.svg` stays the icon,
 * since Next adds the file's only while the metadata names no icons.
 */
export function siteIcons(faviconUrl: string | null | undefined): Metadata["icons"] | undefined {
  const url = faviconUrl?.trim() ?? ""
  const usable = url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//"))
  if (!usable) {
    return undefined
  }
  return {
    icon: [{ url, type: "image/png" }],
    apple: [{ url }],
  }
}
