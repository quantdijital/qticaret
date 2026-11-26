import type {
  StoreThemeSettings,
  ThemeBackground,
  ThemeBodyFont,
  ThemeHeadingFont,
} from "@qticaret/types"
import {
  CARD_BUTTON_STYLES,
  CARD_DENSITIES,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_NO_REVIEWS,
  CARD_RATIOS,
  CARD_SOLD_OUT_ROWS,
  CARD_TEXT_POSITIONS,
  RADIUS_STEPS,
  SECTION_SPACINGS,
  SURFACE_STYLES,
} from "@qticaret/types/storefront"
import type { ThemeView } from "@qticaret/ui"
import { LISTING_TEXT_DEFAULTS, listingTextOf } from "@qticaret/types/listing-text"
import { SEARCH_FORM_DEFAULTS, searchFormOf } from "@qticaret/types/search-form"
import { cardVariantOf } from "@qticaret/types/section-variants"
import { STYLE_KIT_DEFAULTS } from "@qticaret/types/style-kit"
import { accentDeclarations, accentOf } from "./accent"
import { brandDeclarations, isHexColor, readableOn } from "./color"
import { styleKitOf, styleKitView } from "./style-kit"

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
  product_card: {
    ratio: "1:1",
    show_brand: true,
    show_rating: false,
    variant: "standard",
    hover_image: true,
    hover_cycle: false,
    density: "regular",
    delivery_note: true,
    full_button: true,
    sale_badge: true,
    low_stock_badge: true,
    sold_out_badge: true,
    sold_out_row: "price",
    no_reviews: "hide",
    button_style: "outline",
    quick_view: false,
    quick_view_trigger: "hover",
    quick_view_rating: true,
    quick_view_summary: true,
    quick_view_quantity: true,
    text_position: "below",
    rating_badge: false,
    arrow: false,
    duration_row: false,
    per_person: false,
  },
  header: { layout: "left", sticky: true },
  buttons: "pill",
  section_spacing: "normal",
  surface_style: "filled",
  listing_text: { ...LISTING_TEXT_DEFAULTS },
  search_form: { ...SEARCH_FORM_DEFAULTS },
  ...STYLE_KIT_DEFAULTS,
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
  "plus-jakarta": { variable: "--font-plus-jakarta", fallback: SANS, displayWeight: 800 },
  montserrat: { variable: "--font-montserrat", fallback: SANS, displayWeight: 800 },
}

const HEADING_FONTS: readonly ThemeHeadingFont[] = [
  "fraunces",
  "inter",
  "playfair",
  "dm-serif",
  "manrope",
  "plus-jakarta",
  "montserrat",
]
const BODY_FONTS: readonly ThemeBodyFont[] = [
  "inter",
  "manrope",
  "source-sans",
  "nunito",
  "plus-jakarta",
  "montserrat",
]

/**
 * The corner scale's factor (`--radius-scale`); soft is the theme's own.
 * `crisp` and `gentle` stand between sharp and soft (adr/0067 Ek 2026-11-16).
 */
const RADIUS_SCALE = {
  sharp: "0.2",
  crisp: "0.6",
  gentle: "0.8",
  soft: null,
  round: "1.5",
} as const

/**
 * The buttons' corners (`--button-radius`); pill is the theme's own. Square
 * carries its unit: a theme may compare the value with a length (`min()`).
 */
const BUTTON_RADIUS = { pill: null, rounded: "0.75rem", square: "0px" } as const

/** The card picture's shape (`--card-ratio`); square is the theme's own (adr/0062 §9). */
const CARD_RATIO = { "4:5": "4 / 5", "1:1": null, "3:4": "3 / 4", "4:3": "4 / 3" } as const

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

const CARD_FLAGS = [
  "hover_image",
  "hover_cycle",
  "delivery_note",
  "full_button",
  "sale_badge",
  "low_stock_badge",
  "sold_out_badge",
  "quick_view",
  "quick_view_rating",
  "quick_view_summary",
  "quick_view_quantity",
  "rating_badge",
  "arrow",
  "duration_row",
  "per_person",
] as const

/**
 * The card's stars without reviews (adr/0049 Ek 2026-11-15); a backend
 * before the choice answers the framed card's `empty_stars` switch it replaced
 * (on only drew there: another card's stays hidden, as the backend reads it).
 */
const noReviews = (raw: unknown) =>
  oneOf(
    at(raw, "product_card", "no_reviews"),
    CARD_NO_REVIEWS,
    at(raw, "product_card", "empty_stars") === true &&
      at(raw, "product_card", "variant") === "framed"
      ? "empty_stars"
      : DEFAULT_THEME.product_card.no_reviews
  )

/** The card's switches (E5, adr/0049 Ek 2026-11-14 §3.3 and 2026-11-15), each checked. */
const cardFlags = (raw: unknown) =>
  Object.fromEntries(
    CARD_FLAGS.map((key) => [
      key,
      flag(at(raw, "product_card", key), DEFAULT_THEME.product_card[key]),
    ])
  ) as Pick<StoreThemeSettings["product_card"], (typeof CARD_FLAGS)[number]>

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
      // The hand note's face (`accent.ts`): none, absent or unknown leaves it out
      ...accentOf(at(raw, "typography", "accent")),
    },
    radius: oneOf(at(raw, "radius"), RADIUS_STEPS, d.radius),
    product_card: {
      ratio: oneOf(at(raw, "product_card", "ratio"), CARD_RATIOS, d.product_card.ratio),
      show_brand: flag(at(raw, "product_card", "show_brand"), d.product_card.show_brand),
      show_rating: flag(at(raw, "product_card", "show_rating"), d.product_card.show_rating),
      variant: cardVariantOf(at(raw, "product_card", "variant")),
      ...cardFlags(raw),
      sold_out_row: oneOf(
        at(raw, "product_card", "sold_out_row"),
        CARD_SOLD_OUT_ROWS,
        d.product_card.sold_out_row
      ),
      no_reviews: noReviews(raw),
      button_style: oneOf(
        at(raw, "product_card", "button_style"),
        CARD_BUTTON_STYLES,
        d.product_card.button_style
      ),
      quick_view_trigger: oneOf(
        at(raw, "product_card", "quick_view_trigger"),
        CARD_QUICK_VIEW_TRIGGERS,
        d.product_card.quick_view_trigger
      ),
      text_position: oneOf(
        at(raw, "product_card", "text_position"),
        CARD_TEXT_POSITIONS,
        d.product_card.text_position
      ),
      density: oneOf(at(raw, "product_card", "density"), CARD_DENSITIES, d.product_card.density),
    },
    header: {
      layout: oneOf(at(raw, "header", "layout"), ["centered", "left"], d.header.layout),
      sticky: flag(at(raw, "header", "sticky"), d.header.sticky),
    },
    buttons: oneOf(at(raw, "buttons"), ["pill", "rounded", "square"], d.buttons),
    section_spacing: oneOf(at(raw, "section_spacing"), SECTION_SPACINGS, d.section_spacing),
    surface_style: oneOf(at(raw, "surface_style"), SURFACE_STYLES, d.surface_style),
    // A listing's text at its foot (adr/0075 §6): each value checked, a backend before it the defaults
    listing_text: listingTextOf(at(raw, "listing_text") as Parameters<typeof listingTextOf>[0]),
    // The search box's fields (adr/0077 §1): each value checked, a backend before it the defaults
    search_form: searchFormOf(at(raw, "search_form") as Parameters<typeof searchFormOf>[0]),
    ...styleKitOf(raw),
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
    surface: settings.surface_style,
    styleKit: styleKitView(settings),
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
  declarations.push(...accentDeclarations(settings))
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
