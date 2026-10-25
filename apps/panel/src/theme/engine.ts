import { clampChroma, converter, formatCss, wcagContrast } from "culori"
import type { Oklch } from "culori"
import type { AppearanceSettings, ThemeDensity, ThemeMode, ThemeRadius } from "@qticaret/types"

/**
 * The theme engine (docs/18 §5): from what the shop chose (brand colour,
 * radius, density, mode) to every semantic token the panel paints with.
 * Pure: no DOM here (see `apply.ts`). Colours are OKLCH, so lightness steps
 * look even and the brand hue tints the neutrals without staining text.
 */

export type ResolvedMode = Exclude<ThemeMode, "system">

export type ThemeVariables = Record<`--${string}`, string>

export interface ResolvedTheme {
  mode: ResolvedMode
  vars: ThemeVariables
  /** The brand colour was too light or too dark for readable text and was moved. */
  brandAdjusted: boolean
}

/** A colour with its hue always known (grey counts as hue 0). */
export interface Brand {
  l: number
  c: number
  h: number
}

const toOklch = converter("oklch")

// Lightness of each neutral step; chroma is a trace of the brand hue
const NEUTRAL = {
  50: 0.985,
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
type NeutralStep = keyof typeof NEUTRAL

const NEUTRAL_CHROMA = 0.006
const AA_TEXT = 4.5
const AA_LARGE = 3
const WHITE: Oklch = { mode: "oklch", l: 1, c: 0, h: 0 }

// Fixed status hues; only the lightness moves between modes
const STATUS = {
  success: { c: 0.15, h: 150 },
  warning: { c: 0.14, h: 60 },
  destructive: { c: 0.2, h: 25 },
  info: { c: 0.17, h: 255 },
} as const

const RADIUS_PX: Record<ThemeRadius, number> = { sharp: 4, soft: 8, round: 12 }
const DENSITY_PX: Record<ThemeDensity, { control: number; row: number }> = {
  comfortable: { control: 36, row: 40 },
  compact: { control: 32, row: 36 },
}

export function parseBrandColor(hex: string): Brand {
  const parsed = toOklch(hex)
  if (!parsed) {
    throw new RangeError("brand colour must be a hex colour")
  }
  return { l: parsed.l, c: parsed.c, h: parsed.h ?? 0 }
}

const oklch = (l: number, c: number, h: number): Oklch => ({ mode: "oklch", l, c, h })
const css = (color: Oklch): string => formatCss(clampChroma(color, "oklch"))

export const contrast = (a: Oklch, b: Oklch): number =>
  wcagContrast(clampChroma(a, "oklch"), clampChroma(b, "oklch"))

/** White or near-black, whichever reads better on `color`. */
function textOn(color: Oklch, dark: Oklch): Oklch {
  return contrast(WHITE, color) >= contrast(dark, color) ? WHITE : dark
}

/**
 * A fill colour text must sit on: lightness kept in a readable band, then
 * nudged until the better of white and near-black text reaches AA.
 */
function readableFill(
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

function chartColors(hue: number, mode: ResolvedMode): string[] {
  const l = mode === "light" ? 0.6 : 0.72
  return [0, 45, 100, 180, 230].map((turn) => css(oklch(l, 0.13, (hue + turn) % 360)))
}

function statusVars(mode: ResolvedMode, dark: Oklch): ThemeVariables {
  const vars: ThemeVariables = {}
  for (const [name, { c, h }] of Object.entries(STATUS)) {
    const base: Brand = { l: mode === "light" ? 0.55 : 0.68, c, h }
    const fill = readableFill(base, [0.4, 0.78], dark).color
    vars[`--${name}`] = css(fill)
    vars[`--${name}-foreground`] = css(textOn(fill, dark))
  }
  return vars
}

type Neutral = (step: NeutralStep) => string

function lightVars(brand: Brand, n: Neutral, dark: Oklch): ThemeVariables {
  const primary = readableFill(brand, [0.4, 0.62], dark)
  const primaryCss = css(primary.color)
  const primaryText = css(textOn(primary.color, dark))
  return {
    "--background": n(50),
    "--foreground": n(950),
    "--card": css(WHITE),
    "--card-foreground": n(950),
    "--popover": css(WHITE),
    "--popover-foreground": n(950),
    "--primary": primaryCss,
    "--primary-foreground": primaryText,
    "--secondary": n(100),
    "--secondary-foreground": n(900),
    "--muted": n(100),
    "--muted-foreground": n(600),
    "--accent": css(oklch(0.95, Math.min(brand.c, 0.04), brand.h)),
    "--accent-foreground": css(oklch(0.35, Math.min(brand.c, 0.12), brand.h)),
    "--border": n(200),
    "--input": n(300),
    "--ring": primaryCss,
    "--sidebar": css(WHITE),
    "--sidebar-foreground": n(900),
    "--sidebar-primary": primaryCss,
    "--sidebar-primary-foreground": primaryText,
    "--sidebar-accent": n(100),
    "--sidebar-accent-foreground": n(900),
    "--sidebar-border": n(200),
    "--sidebar-ring": primaryCss,
  }
}

function darkVars(brand: Brand, n: Neutral, dark: Oklch): ThemeVariables {
  // On a dark page the fill must also stand out from the page itself
  const primary = readableFill(brand, [0.58, 0.78], dark)
  const primaryCss = css(primary.color)
  const primaryText = css(textOn(primary.color, dark))
  const surface = (l: number) => css(oklch(l, NEUTRAL_CHROMA, brand.h))
  return {
    "--background": surface(0.145),
    "--foreground": n(50),
    "--card": surface(0.19),
    "--card-foreground": n(50),
    "--popover": surface(0.19),
    "--popover-foreground": n(50),
    "--primary": primaryCss,
    "--primary-foreground": primaryText,
    "--secondary": surface(0.24),
    "--secondary-foreground": n(100),
    "--muted": surface(0.24),
    "--muted-foreground": n(400),
    "--accent": css(oklch(0.3, Math.min(brand.c, 0.06), brand.h)),
    "--accent-foreground": css(oklch(0.85, Math.min(brand.c, 0.1), brand.h)),
    "--border": surface(0.27),
    "--input": surface(0.3),
    "--ring": primaryCss,
    "--sidebar": surface(0.17),
    "--sidebar-foreground": n(100),
    "--sidebar-primary": primaryCss,
    "--sidebar-primary-foreground": primaryText,
    "--sidebar-accent": surface(0.24),
    "--sidebar-accent-foreground": n(100),
    "--sidebar-border": surface(0.27),
    "--sidebar-ring": primaryCss,
  }
}

/** Every token for one mode; `brandAdjusted` says whether the brand had to move for AA text. */
export function resolveTheme(settings: AppearanceSettings, mode: ResolvedMode): ResolvedTheme {
  const brand = parseBrandColor(settings.brand_color)
  const dark = oklch(NEUTRAL[950], NEUTRAL_CHROMA, brand.h)
  const n: Neutral = (step) => css(oklch(NEUTRAL[step], NEUTRAL_CHROMA, brand.h))
  const colors = mode === "light" ? lightVars(brand, n, dark) : darkVars(brand, n, dark)
  const charts: ThemeVariables = {}
  chartColors(brand.h, mode).forEach((value, index) => {
    charts[`--chart-${String(index + 1)}`] = value
  })
  const density = DENSITY_PX[settings.density]
  return {
    mode,
    brandAdjusted: readableFill(brand, [0.4, 0.62], dark).adjusted,
    vars: {
      ...colors,
      ...statusVars(mode, dark),
      ...charts,
      "--radius": `${String(RADIUS_PX[settings.radius])}px`,
      "--control-height": `${String(density.control)}px`,
      "--row-height": `${String(density.row)}px`,
    },
  }
}

export { AA_LARGE, AA_TEXT }
