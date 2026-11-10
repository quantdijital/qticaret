import { AA_LARGE, NEUTRAL_CHROMA, css, cssAlpha, oklch, standOut } from "./color"
import type { Brand } from "./color"

/**
 * Chart colours (docs/18 §5, dataviz method): the brand hue is the one
 * series colour; a quiet grey carries the comparison series; an ordinal
 * ramp of the brand hue carries ordered stages (an order's life). Marks
 * stand out from the card at 3:1; the ramp's lightest step clears 2:1.
 * `--chart-2..5` are categorical slots for charts that compare series.
 */

type Mode = "light" | "dark"

// Card lightness per mode (engine.ts): what the marks sit on
const CARD_L: Record<Mode, number> = { light: 1, dark: 0.19 }

// Ordered stages, lightest to darkest in light mode and the reverse in dark,
// so the step nearest the surface still reads (≥ 2:1)
const RAMP_L: Record<Mode, number[]> = {
  light: [0.74, 0.63, 0.52, 0.41],
  dark: [0.44, 0.55, 0.66, 0.77],
}

function categorical(hue: number, mode: Mode): string[] {
  const l = mode === "light" ? 0.6 : 0.72
  return [45, 100, 180, 230].map((turn) => css(oklch(l, 0.13, (hue + turn) % 360)))
}

export function chartVars(brand: Brand, mode: Mode): Record<`--${string}`, string> {
  const card = oklch(CARD_L[mode], 0, brand.h)
  const start = mode === "light" ? Math.min(Math.max(brand.l, 0.45), 0.62) : Math.max(brand.l, 0.66)
  const series = standOut(brand, card, AA_LARGE, start)
  // A grey brand (black, white) keeps grey stages rather than an invented hue
  const rampChroma = brand.c < 0.02 ? 0 : Math.min(Math.max(brand.c, 0.06), 0.16)
  const vars: Record<`--${string}`, string> = {
    "--chart-1": css(series),
    "--chart-1-wash": cssAlpha(series, mode === "light" ? 0.12 : 0.2),
    "--chart-muted": css(oklch(mode === "light" ? 0.8 : 0.45, NEUTRAL_CHROMA, brand.h)),
    "--chart-grid": css(oklch(mode === "light" ? 0.94 : 0.26, NEUTRAL_CHROMA, brand.h)),
    // Canceled sits outside the ordered stages: a muted red, apart from any brand ramp
    "--chart-canceled": css(oklch(mode === "light" ? 0.68 : 0.56, 0.13, 25)),
  }
  RAMP_L[mode].forEach((l, index) => {
    vars[`--chart-ramp-${String(index + 1)}`] = css(oklch(l, rampChroma, brand.h))
  })
  categorical(brand.h, mode).forEach((value, index) => {
    vars[`--chart-${String(index + 2)}`] = value
  })
  return vars
}
