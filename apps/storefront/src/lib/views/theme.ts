import type {
  StoreThemeSettings,
  ThemeBackground,
  ThemeBodyFont,
  ThemeHeadingFont,
} from "@qticaret/types"
import type { ThemeView } from "@qticaret/ui"
import { brandDeclarations, isHexColor, readableOn } from "./color"

/**
 * The shop's theme settings (adr/0053 §B) as the storefront applies them:
 * CSS variables in the page's one nonce'd style element, the faces'
 * preloads (`app/fonts.ts`), and the choices that change markup (`ThemeView`).
 * The settings are choices from fixed lists; anything else falls back to
 * the default, so nothing the backend sends reaches CSS unchecked. At the
 * defaults nothing is printed: the theme's own look stands.
 */

/**
 * Today's Grafit look (adr/0062 §2; backend `themeSection`'s defaults, the
 * two must stay equal): what the theme draws with nothing printed.
 */
export const DEFAULT_THEME: StoreThemeSettings = {
  theme: "atolye",
  colors: { primary: null, accent: null, background: "steel" },
  typography: { heading: "manrope", body: "manrope" },
  radius: "soft",
  product_card: { ratio: "1:1", show_brand: true, show_rating: false },
  header: { layout: "left", sticky: true },
  buttons: "pill",
}

/**
 * The page colours, as the backend's contrast check reads them
 * (`THEME_BACKGROUNDS`): the two must stay equal. `steel` is the theme's
 * own `--color-paper` in sRGB (adr/0062 §3; the spec derives it from the token).
 * Painting a tone is the theme's: its entry prints its own surfaces for
 * it (adr/0062 §5), each tone's counter being the value here.
 */
export const THEME_BACKGROUNDS: Readonly<Record<ThemeBackground, string>> = {
  steel: "#f8fafc",
  warm: "#f6f4ef",
  neutral: "#f5f5f5",
  cool: "#f3f5f8",
}

export type ThemeFont = ThemeHeadingFont | ThemeBodyFont

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

/** The weight a theme's headings are set in when the face has it (`--display-weight`). */
const DISPLAY_WEIGHT = 800

/**
 * Each face's CSS variable (`app/fonts.css` sets it), the fallback its kind
 * wants, and the weight its headings take: the heaviest its file carries up
 * to 800 (adr/0062 §7). DM Serif Display has one weight; a heading asked
 * for 800 there would lean on the browser's matching, so its own is printed.
 */
export const THEME_FONTS: Readonly<
  Record<ThemeFont, { variable: string; fallback: string; displayWeight: number }>
> = {
  fraunces: { variable: "--font-fraunces", fallback: SERIF, displayWeight: 800 },
  playfair: { variable: "--font-playfair", fallback: SERIF, displayWeight: 800 },
  "dm-serif": { variable: "--font-dm-serif", fallback: SERIF, displayWeight: 400 },
  inter: { variable: "--font-inter", fallback: SANS, displayWeight: 800 },
  manrope: { variable: "--font-manrope", fallback: SANS, displayWeight: 800 },
  "source-sans": { variable: "--font-source-sans", fallback: SANS, displayWeight: 800 },
  nunito: { variable: "--font-nunito", fallback: SANS, displayWeight: 800 },
}

const HEADING_FONTS: readonly ThemeHeadingFont[] = [
  "fraunces",
  "inter",
  "playfair",
  "dm-serif",
  "manrope",
]
const BODY_FONTS: readonly ThemeBodyFont[] = ["inter", "manrope", "source-sans", "nunito"]

/** The corner scale's factor (`--radius-scale`); soft is the theme's own. */
const RADIUS_SCALE = { sharp: "0.2", soft: null, round: "1.5" } as const

/**
 * The buttons' corners (`--button-radius`); pill is the theme's own. Square
 * carries its unit: a theme may compare the value with a length (`min()`).
 */
const BUTTON_RADIUS = { pill: null, rounded: "0.75rem", square: "0px" } as const

/** The card picture's shape (`--card-ratio`); square is the theme's own (adr/0062 §9). */
const CARD_RATIO = { "4:5": "4 / 5", "1:1": null, "3:4": "3 / 4" } as const

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

/** A nested field of an answer read as nothing in particular: what is missing is undefined. */
const at = (value: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>(
    (node, key) =>
      node !== null && typeof node === "object"
        ? (node as Record<string, unknown>)[key]
        : undefined,
    value
  )

/**
 * The settings to apply, every field checked: `GET /store/storefront`'s
 * `theme`, or the defaults with the storefront section's colour from a
 * backend before adr/0053.
 */
export function themeSettings(raw: unknown, fallbackPrimary: string | null): StoreThemeSettings {
  const d = DEFAULT_THEME
  const primary = at(raw, "colors", "primary") ?? fallbackPrimary
  const accent = at(raw, "colors", "accent")
  return {
    theme: "atolye",
    colors: {
      primary: isHexColor(primary) ? primary : null,
      accent: isHexColor(accent) ? accent : null,
      background: oneOf(
        at(raw, "colors", "background"),
        Object.keys(THEME_BACKGROUNDS) as ThemeBackground[],
        d.colors.background
      ),
    },
    typography: {
      heading: oneOf(at(raw, "typography", "heading"), HEADING_FONTS, d.typography.heading),
      body: oneOf(at(raw, "typography", "body"), BODY_FONTS, d.typography.body),
    },
    radius: oneOf(at(raw, "radius"), ["sharp", "soft", "round"], d.radius),
    product_card: {
      ratio: oneOf(at(raw, "product_card", "ratio"), ["4:5", "1:1", "3:4"], d.product_card.ratio),
      show_brand: flag(at(raw, "product_card", "show_brand"), d.product_card.show_brand),
      show_rating: flag(at(raw, "product_card", "show_rating"), d.product_card.show_rating),
    },
    header: {
      layout: oneOf(at(raw, "header", "layout"), ["centered", "left"], d.header.layout),
      sticky: flag(at(raw, "header", "sticky"), d.header.sticky),
    },
    buttons: oneOf(at(raw, "buttons"), ["pill", "rounded", "square"], d.buttons),
  }
}

/** The choices the theme draws itself. */
export function themeView(settings: StoreThemeSettings): ThemeView {
  return {
    card: {
      ratio: settings.product_card.ratio,
      showBrand: settings.product_card.show_brand,
      showRating: settings.product_card.show_rating,
    },
    header: { layout: settings.header.layout, sticky: settings.header.sticky },
    buttons: settings.buttons,
  }
}

const fontValue = (font: ThemeFont) =>
  `var(${THEME_FONTS[font].variable}), ${THEME_FONTS[font].fallback}`

/**
 * The settings as CSS variables over the theme's own (docs/19 §3), one
 * `:root` rule for the page's nonce'd style element; null at the defaults.
 * `own` is what the theme prints for the same settings on its own tokens
 * (a page tone's surfaces, adr/0062 §5), from fixed lists as the rest.
 */
export function themeStyle(
  settings: StoreThemeSettings,
  own: readonly string[] = []
): string | null {
  const { colors, typography, radius, product_card, buttons } = settings
  const declarations = [...brandDeclarations(colors.primary)]
  if (isHexColor(colors.accent)) {
    declarations.push(
      `--highlight:${colors.accent}`,
      `--highlight-foreground:${readableOn(colors.accent)}`
    )
  }
  if (typography.heading !== DEFAULT_THEME.typography.heading) {
    declarations.push(`--font-heading:${fontValue(typography.heading)}`)
  }
  const weight = THEME_FONTS[typography.heading].displayWeight
  if (weight !== DISPLAY_WEIGHT) {
    declarations.push(`--display-weight:${weight}`)
  }
  if (typography.body !== DEFAULT_THEME.typography.body) {
    declarations.push(`--font-sans:${fontValue(typography.body)}`)
  }
  const scale = RADIUS_SCALE[radius]
  if (scale) {
    declarations.push(`--radius-scale:${scale}`)
  }
  const button = BUTTON_RADIUS[buttons]
  if (button) {
    declarations.push(`--button-radius:${button}`)
  }
  const ratio = CARD_RATIO[product_card.ratio]
  if (ratio) {
    declarations.push(`--card-ratio:${ratio}`)
  }
  declarations.push(...own)
  return declarations.length > 0 ? `:root{${declarations.join(";")}}` : null
}
