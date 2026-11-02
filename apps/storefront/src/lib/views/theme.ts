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

/** Today's look (backend `themeSection`'s defaults). */
export const DEFAULT_THEME: StoreThemeSettings = {
  theme: "base",
  colors: { primary: null, accent: null, background: "warm" },
  typography: { heading: "fraunces", body: "inter" },
  radius: "soft",
  product_card: { ratio: "4:5", show_brand: true, show_rating: false },
  header: { layout: "centered", sticky: true },
  buttons: "pill",
}

/**
 * The page colours, as the backend's contrast check reads them
 * (`THEME_BACKGROUNDS`): the two must stay equal.
 */
export const THEME_BACKGROUNDS: Readonly<Record<ThemeBackground, string>> = {
  warm: "#f6f4ef",
  neutral: "#f5f5f5",
  cool: "#f3f5f8",
}

/**
 * The quiet surfaces, lines and secondary text that go with a page colour;
 * `warm` is the theme's own. Secondary text keeps WCAG AA on the page
 * (6.4:1 and more), on muted surfaces (5.8:1) and on cards (7.0:1).
 */
const NEUTRALS: Readonly<Record<Exclude<ThemeBackground, "warm">, readonly string[]>> = {
  neutral: [
    "--secondary:#ebebeb",
    "--muted:#ebebeb",
    "--accent:#ebebeb",
    "--border:#e0e0e0",
    "--input:#cfcfcf",
    "--muted-foreground:#585858",
  ],
  cool: [
    "--secondary:#e8ecf1",
    "--muted:#e8ecf1",
    "--accent:#e8ecf1",
    "--border:#dce1e8",
    "--input:#c9d0da",
    "--muted-foreground:#525a66",
  ],
}

export type ThemeFont = ThemeHeadingFont | ThemeBodyFont

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

/** Each face's CSS variable (`app/fonts.css` sets it) and the fallback its kind wants. */
export const THEME_FONTS: Readonly<Record<ThemeFont, { variable: string; fallback: string }>> = {
  fraunces: { variable: "--font-fraunces", fallback: SERIF },
  playfair: { variable: "--font-playfair", fallback: SERIF },
  "dm-serif": { variable: "--font-dm-serif", fallback: SERIF },
  inter: { variable: "--font-inter", fallback: SANS },
  manrope: { variable: "--font-manrope", fallback: SANS },
  "source-sans": { variable: "--font-source-sans", fallback: SANS },
  nunito: { variable: "--font-nunito", fallback: SANS },
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

/** The buttons' corners (`--button-radius`); pill is the theme's own. */
const BUTTON_RADIUS = { pill: null, rounded: "0.75rem", square: "0" } as const

/** The card picture's shape (`--card-ratio`); 4:5 is the theme's own. */
const CARD_RATIO = { "4:5": null, "1:1": "1 / 1", "3:4": "3 / 4" } as const

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
    theme: "base",
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
 */
export function themeStyle(settings: StoreThemeSettings): string | null {
  const { colors, typography, radius, product_card, buttons } = settings
  const declarations = [...brandDeclarations(colors.primary)]
  if (isHexColor(colors.accent)) {
    declarations.push(
      `--highlight:${colors.accent}`,
      `--highlight-foreground:${readableOn(colors.accent)}`
    )
  }
  if (colors.background !== "warm") {
    declarations.push(
      `--background:${THEME_BACKGROUNDS[colors.background]}`,
      ...NEUTRALS[colors.background]
    )
  }
  if (typography.heading !== DEFAULT_THEME.typography.heading) {
    declarations.push(`--font-heading:${fontValue(typography.heading)}`)
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
  return declarations.length > 0 ? `:root{${declarations.join(";")}}` : null
}
