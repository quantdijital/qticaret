import type { Oklch } from "culori"
import type { ThemeSurface } from "@qticaret/types"
import { NEUTRAL_CHROMA, oklch } from "./color"
import type { Brand } from "./color"

/**
 * The tone every surface is drawn in (docs/18 §5, the "Zemin rengi"
 * choice): the page, cards, borders, hover and selection grounds, the
 * navigation's ink and the charts' grid. `brand` is the panel's first look,
 * a trace of the brand hue; `neutral` is plain grey; `warm` and `cool` are
 * fixed greys of their own, the same whatever the brand colour. The brand
 * colour itself (buttons, links, charts' series) is not the ground's.
 */

type Mode = "light" | "dark"

export interface Ground {
  /** The hue the greys lean towards. */
  h: number
  /** The greys' chroma (page, cards, borders, text greys). */
  c: number
  /** The hover and selection ground's chroma (`--accent`). */
  accent: number
  /** The text on that ground (`--accent-foreground`). */
  accentText: number
  /** The dark navigation's chroma (the ink sidebar, its raised item). */
  ink: number
  /** The light navigation's hover ground. */
  sidebarAccent: number
}

// A warm and a cool grey: hue fixed, chroma a little above the brand trace
// so the lean shows, still far from a colour
const FIXED: Record<"warm" | "cool", { h: number; c: number; accent: number; text: number }> = {
  warm: { h: 70, c: 0.008, accent: 0.014, text: 0.03 },
  cool: { h: 250, c: 0.008, accent: 0.016, text: 0.04 },
}

export function groundOf(surface: ThemeSurface | undefined, brand: Brand, mode: Mode): Ground {
  if (surface === "neutral") {
    return { h: 0, c: 0, accent: 0, accentText: 0, ink: 0, sidebarAccent: 0 }
  }
  if (surface === "warm" || surface === "cool") {
    const { h, c, accent, text } = FIXED[surface]
    return { h, c, accent, accentText: text, ink: c * 1.5, sidebarAccent: accent }
  }
  // `brand`, and a setting remembered before the choice existed
  return {
    h: brand.h,
    c: NEUTRAL_CHROMA,
    accent: Math.min(brand.c, mode === "light" ? 0.035 : 0.06),
    accentText: Math.min(brand.c, mode === "light" ? 0.12 : 0.1),
    ink: Math.min(brand.c, 0.02),
    sidebarAccent: Math.min(brand.c, 0.02),
  }
}

/** A grey of the ground at lightness `l` (chroma: the ground's, unless given). */
export const tone = (ground: Ground, l: number, c: number = ground.c): Oklch =>
  oklch(l, c, ground.h)
