import type { ImageView } from "@qticaret/ui"
import { isHexColor, readableOn } from "./color"

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

/** The ground a logo stands on: the page's light well or a dark one (the stage, a dark colour). */
export type LogoGround = "light" | "dark"

/**
 * The footer's logo for each ground it may stand on (a free rows footer's
 * row picks its own): the light and the dark ground, and the shop's main
 * colour as the theme fills it.
 */
export interface FooterLogos {
  light: ImageView | null
  dark: ImageView | null
  primary: ImageView | null
}

const size = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null

/**
 * The logo the footer names the shop with (owner 2026-11-16: "header
 * logosuyla bağlansın"): the store profile's own, as the header's, never a
 * second upload. On a light ground the light-ground logo first, the
 * dark-ground one when the shop has only that; on a dark ground the other
 * way round (a dark logo on the stage did not read). Its size when the
 * library measured it (an SVG's from its viewBox), so the box is kept as it
 * loads. None: null, and the footer writes the name. A backend before the
 * two logos: the one address, size unknown, on either ground.
 */
export function footerLogoOf(shop: LogoSource, ground: LogoGround = "light"): ImageView | null {
  const { logos } = shop
  const logo = logos
    ? ground === "dark"
      ? (logos.dark ?? logos.light)
      : (logos.light ?? logos.dark)
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

/**
 * Whether the shop's main colour is a dark ground: white text reads better
 * on it. None chosen: the theme's own, Atölye's wine, dark
 * (`--primary-foreground` is white in its `styles.css`).
 */
const darkPrimary = (primary: string | null): boolean =>
  !isHexColor(primary) || readableOn(primary) === "#ffffff"

/** The footer's logos by ground (`FooterLogos`), the main colour's read from `primary`. */
export function footerLogosOf(shop: LogoSource, primary: string | null): FooterLogos {
  const light = footerLogoOf(shop, "light")
  const dark = footerLogoOf(shop, "dark")
  return { light, dark, primary: darkPrimary(primary) ? dark : light }
}
