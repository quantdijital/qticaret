import type { Oklch } from "culori"
import type { AppearanceSettings, ThemeDensity, ThemeMode, ThemeRadius } from "@qticaret/types"
import { chartVars } from "./charts"
import {
  AA_LARGE,
  AA_TEXT,
  NEUTRAL,
  WHITE,
  contrast,
  css,
  cssAlpha,
  oklch,
  parseBrandColor,
  readableFill,
  standOut,
  textOn,
} from "./color"
import type { Brand, NeutralStep } from "./color"
import { groundOf, tone } from "./ground"
import type { Ground } from "./ground"
import { sidebarVars } from "./sidebar"

/**
 * The theme engine (docs/18 §5): from what the shop chose (brand colour,
 * surface tone, sidebar, radius, density, mode) to every token the panel paints with.
 * Pure: no DOM here (see `apply.ts`).
 */

export type ResolvedMode = Exclude<ThemeMode, "system">

export type ThemeVariables = Record<`--${string}`, string>

export interface ResolvedTheme {
  mode: ResolvedMode
  vars: ThemeVariables
  /** The brand colour was too light or too dark for readable text and was moved. */
  brandAdjusted: boolean
}

// Fixed status hues; only the lightness moves between modes
const STATUS = {
  success: { c: 0.15, h: 150 },
  warning: { c: 0.14, h: 60 },
  destructive: { c: 0.2, h: 25 },
  info: { c: 0.17, h: 255 },
} as const

const RADIUS_PX: Record<ThemeRadius, number> = { sharp: 4, soft: 8, round: 12 }
const DENSITY_PX: Record<ThemeDensity, { control: number; row: number }> = {
  comfortable: { control: 36, row: 44 },
  compact: { control: 32, row: 38 },
}

type Neutral = (step: NeutralStep) => string

function statusVars(mode: ResolvedMode, dark: Oklch): ThemeVariables {
  const vars: ThemeVariables = {}
  for (const [name, { c, h }] of Object.entries(STATUS)) {
    const base: Brand = { l: mode === "light" ? 0.55 : 0.68, c, h }
    const fill = readableFill(base, [0.4, 0.78], dark).color
    vars[`--${name}`] = css(fill)
    vars[`--${name}-foreground`] = css(textOn(fill, dark))
    // A quiet tint behind a status label, and the label's own darker (or,
    // in dark mode, lighter) step that reads on the tint and on cards
    const soft = oklch(mode === "light" ? 0.965 : 0.27, c * 0.35, h)
    vars[`--${name}-soft`] = css(soft)
    vars[`--${name}-text`] = css(
      standOut({ l: 0, c, h }, soft, AA_TEXT, mode === "light" ? 0.5 : 0.78)
    )
  }
  return vars
}

/**
 * The brand as text (links, "Göster"): the fill's own lightness, moved only
 * as far as AA on the surface it reads worst on (muted: the darkest light one,
 * the lightest dark one).
 */
function primaryText(brand: Brand, fill: Oklch, surface: Oklch): Oklch {
  return standOut(brand, surface, AA_TEXT, fill.l)
}

function lightVars(brand: Brand, g: Ground, n: Neutral, dark: Oklch): ThemeVariables {
  const primary = readableFill(brand, [0.4, 0.62], dark)
  const primaryCss = css(primary.color)
  return {
    "--background": n(75),
    "--foreground": n(950),
    "--card": css(WHITE),
    "--card-foreground": n(950),
    "--popover": css(WHITE),
    "--popover-foreground": n(950),
    "--primary": primaryCss,
    "--primary-foreground": css(textOn(primary.color, dark)),
    "--primary-text": css(primaryText(brand, primary.color, tone(g, NEUTRAL[100]))),
    "--secondary": n(100),
    "--secondary-foreground": n(900),
    "--muted": n(100),
    "--muted-foreground": n(600),
    "--accent": css(tone(g, 0.955, g.accent)),
    "--accent-foreground": css(tone(g, 0.35, g.accentText)),
    "--border": n(200),
    "--input": n(300),
    "--ring": primaryCss,
    "--shadow-card": `0 1px 2px 0 ${cssAlpha(tone(g, 0.145), 0.06)}`,
  }
}

function darkVars(brand: Brand, g: Ground, n: Neutral, dark: Oklch): ThemeVariables {
  // On a dark page the fill must also stand out from the page itself
  const primary = readableFill(brand, [0.58, 0.78], dark)
  const primaryCss = css(primary.color)
  const surface = (l: number) => css(tone(g, l))
  return {
    "--background": surface(0.145),
    "--foreground": n(50),
    "--card": surface(0.19),
    "--card-foreground": n(50),
    "--popover": surface(0.21),
    "--popover-foreground": n(50),
    "--primary": primaryCss,
    "--primary-foreground": css(textOn(primary.color, dark)),
    "--primary-text": css(primaryText(brand, primary.color, tone(g, 0.24))),
    "--secondary": surface(0.24),
    "--secondary-foreground": n(100),
    "--muted": surface(0.24),
    "--muted-foreground": n(400),
    "--accent": css(tone(g, 0.29, g.accent)),
    "--accent-foreground": css(tone(g, 0.86, g.accentText)),
    "--border": surface(0.27),
    "--input": surface(0.3),
    "--ring": primaryCss,
    "--shadow-card": `0 1px 0 0 ${cssAlpha(oklch(0, 0, 0), 0.3)}`,
  }
}

/** Every token for one mode; `brandAdjusted` says whether the brand had to move for AA text. */
export function resolveTheme(settings: AppearanceSettings, mode: ResolvedMode): ResolvedTheme {
  const brand = parseBrandColor(settings.brand_color)
  const g = groundOf(settings.surface, brand, mode)
  const dark = tone(g, NEUTRAL[950])
  const n: Neutral = (step) => css(tone(g, NEUTRAL[step]))
  const colors = mode === "light" ? lightVars(brand, g, n, dark) : darkVars(brand, g, n, dark)
  const density = DENSITY_PX[settings.density]
  return {
    mode,
    brandAdjusted: readableFill(brand, [0.4, 0.62], dark).adjusted,
    vars: {
      ...colors,
      ...sidebarVars(settings.sidebar, brand, g, mode, dark),
      ...statusVars(mode, dark),
      ...chartVars(brand, g, mode),
      "--radius": `${String(RADIUS_PX[settings.radius])}px`,
      "--control-height": `${String(density.control)}px`,
      "--row-height": `${String(density.row)}px`,
    },
  }
}

export { AA_LARGE, AA_TEXT, contrast, parseBrandColor }
