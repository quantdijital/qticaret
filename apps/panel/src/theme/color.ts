import { clampChroma, converter, formatCss, wcagContrast } from "culori"
import type { Oklch } from "culori"

/**
 * Colour helpers the theme engine builds on (docs/18 §5). OKLCH throughout:
 * lightness steps look even, and the brand hue can tint the neutrals
 * without staining text.
 */

/** A colour with its hue always known (grey counts as hue 0). */
export interface Brand {
  l: number
  c: number
  h: number
}

export const AA_TEXT = 4.5
export const AA_LARGE = 3

// Lightness of each neutral step; chroma is a trace of the brand hue
export const NEUTRAL = {
  50: 0.985,
  75: 0.972,
  100: 0.965,
  200: 0.925,
  300: 0.87,
  400: 0.72,
  500: 0.58,
  600: 0.48,
  700: 0.4,
  800: 0.3,
  900: 0.22,
  950: 0.145,
} as const
export type NeutralStep = keyof typeof NEUTRAL
export const NEUTRAL_CHROMA = 0.006

export const WHITE: Oklch = { mode: "oklch", l: 1, c: 0, h: 0 }

const toOklch = converter("oklch")

export function parseBrandColor(hex: string): Brand {
  const parsed = toOklch(hex)
  if (!parsed) {
    throw new RangeError("brand colour must be a hex colour")
  }
  return { l: parsed.l, c: parsed.c, h: parsed.h ?? 0 }
}

export const oklch = (l: number, c: number, h: number): Oklch => ({ mode: "oklch", l, c, h })

export const css = (color: Oklch): string => formatCss(clampChroma(color, "oklch"))

/** `color` with an alpha, for washes and shadows. */
export const cssAlpha = (color: Oklch, alpha: number): string =>
  formatCss({ ...clampChroma(color, "oklch"), alpha })

export const contrast = (a: Oklch, b: Oklch): number =>
  wcagContrast(clampChroma(a, "oklch"), clampChroma(b, "oklch"))

/** White or near-black, whichever reads better on `color`. */
export function textOn(color: Oklch, dark: Oklch): Oklch {
  return contrast(WHITE, color) >= contrast(dark, color) ? WHITE : dark
}

/**
 * A fill colour text must sit on: lightness kept in a band, then nudged
 * until the better of white and near-black text reaches AA.
 */
export function readableFill(
  brand: Brand,
  band: [number, number],
  dark: Oklch
): { color: Oklch; adjusted: boolean } {
  let l = Math.min(Math.max(brand.l, band[0]), band[1])
  const direction = l <= 0.5 ? -1 : 1
  let fill = oklch(l, brand.c, brand.h)
  let steps = 0
  while (contrast(textOn(fill, dark), fill) < AA_TEXT && steps < 30) {
    l += direction * 0.01
    fill = oklch(l, brand.c, brand.h)
    steps += 1
  }
  return { color: fill, adjusted: Math.abs(fill.l - brand.l) > 0.005 }
}

/**
 * A mark or text colour that must stand out from `surface` by `ratio`:
 * the brand hue moved away from the surface's lightness until it does.
 */
export function standOut(brand: Brand, surface: Oklch, ratio: number, start: number): Oklch {
  const direction = surface.l > 0.5 ? -1 : 1
  let color = oklch(start, brand.c, brand.h)
  let steps = 0
  while (contrast(color, surface) < ratio && steps < 60) {
    color = oklch(color.l + direction * 0.01, brand.c, brand.h)
    steps += 1
  }
  return color
}
