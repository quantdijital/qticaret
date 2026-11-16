import type { ImageView } from "@qticaret/ui"

/** A store profile logo as `GET /store/seo/site` names it: the shop's own upload and its size. */
export interface SiteLogo {
  url: string
  width: number | null
  height: number | null
}

/** The site answer's shop fields this reads; `logos` absent from a backend before it. */
export interface LogoSource {
  name: string
  logo_url: string | null
  logos?: { light: SiteLogo | null; dark: SiteLogo | null } | null
}

const size = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null

/**
 * The logo the footer names the shop with when it chose the logo (owner
 * 2026-11-16): the store profile's own, never a second upload. The footer
 * stands on the page's light well, so the light-ground logo first, the
 * dark-ground one when the shop has only that; its size when the library
 * measured it (an SVG's from its viewBox), so the box is kept as it loads.
 * None: null, and the footer writes the name. A backend before the two
 * logos: the light one by its address, size unknown.
 */
export function footerLogoOf(shop: LogoSource): ImageView | null {
  const logo = shop.logos
    ? (shop.logos.light ?? shop.logos.dark)
    : shop.logo_url
      ? { url: shop.logo_url, width: null, height: null }
      : null
  if (!logo || typeof logo.url !== "string" || logo.url.length === 0) {
    return null
  }
  return {
    src: logo.url,
    alt: shop.name,
    width: size(logo.width),
    height: size(logo.height),
    sources: { avif: null, webp: null },
  }
}
