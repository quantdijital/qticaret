import { z } from "@medusajs/framework/zod"
import { AA_LARGE_TEXT, contrastRatio } from "../../../lib/color/contrast"
import { defineSection, isPlainObject } from "./define"
import {
  PRODUCT_CARD_DEFAULTS,
  PRODUCT_CARD_VARIANTS,
  productCardSchema,
  upgradeCard,
} from "./theme-card"
import type { ProductCardSettings } from "./theme-card"
import {
  LISTING_TEXT_DEFAULTS,
  listingTextSchema,
  withListingTextDefaults,
} from "./theme-listing-text"
import type { ListingTextSettings } from "./theme-listing-text"
import { SEARCH_FORM_DEFAULTS, searchFormSchema, withSearchFormDefaults } from "./theme-search-form"
import type { SearchFormSettings } from "./theme-search-form"
import { STYLE_KIT_DEFAULTS, styleKitSchema, withStyleKitDefaults } from "./theme-style-kit"
import type { StyleKitSettings } from "./theme-style-kit"
import { ACCENT_FONTS, RADIUS_STEPS, SECTION_SPACINGS, SURFACE_STYLES } from "./theme-steps"

export {
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_SOLD_OUT_ROWS,
  CARD_TEXT_POSITIONS,
  PRODUCT_CARD_VARIANTS,
  upgradeCard,
} from "./theme-card"
export type { ProductCardSettings } from "./theme-card"
export { LISTING_TEXT, LISTING_TEXT_DEFAULTS, withListingTextDefaults } from "./theme-listing-text"
export type { ListingTextSettings } from "./theme-listing-text"
export { SEARCH_FORM_DEFAULTS } from "./theme-search-form"
export type { SearchFormSettings } from "./theme-search-form"
export { STYLE_KIT, STYLE_KIT_DEFAULTS, withStyleKitDefaults } from "./theme-style-kit"
export { ACCENT_FONTS, RADIUS_STEPS, SECTION_SPACINGS, SURFACE_STYLES } from "./theme-steps"

/** The storefront themes this build carries (adr/0046 §7); a new theme is a deploy. */
export const INSTALLED_THEMES = ["atolye"] as const

/**
 * The first theme's name, removed with it (adr/0057 Ek 2026-11-09): a
 * section stored before then reads as Atölye and is saved so next time.
 */
const REMOVED_THEMES: Readonly<Record<string, (typeof INSTALLED_THEMES)[number]>> = {
  base: "atolye",
}

/**
 * Self-hosted faces the storefront has a loader for: a name from this list,
 * never an address (no third-party font host sees the shop's visitors).
 */
export const HEADING_FONTS = [
  "fraunces",
  "inter",
  "playfair",
  "dm-serif",
  "manrope",
  "plus-jakarta",
  "montserrat",
] as const
export const BODY_FONTS = [
  "inter",
  "manrope",
  "source-sans",
  "nunito",
  "plus-jakarta",
  "montserrat",
] as const

/**
 * The page colours a theme offers, as the storefront paints them: the
 * contrast check reads these, so the storefront must use the same values
 * (adr/0053 §B.2, adr/0062 §3). `steel` is Grafit's counter, Atölye's
 * `--color-paper` (`oklch(98.4% 0.003 250)`) in sRGB; the storefront's
 * tests derive it from the token, so the two cannot drift apart.
 */
export const THEME_BACKGROUNDS = {
  steel: "#f8fafc",
  warm: "#f6f4ef",
  neutral: "#f5f5f5",
  cool: "#f3f5f8",
} as const

export type ThemeBackground = keyof typeof THEME_BACKGROUNDS

/**
 * Each page colour's well, the tinted ground links and outlined controls
 * also stand on (Atölye's `paper-2` for the tone, `ATOLYE_TONES` in the
 * theme package; the storefront's tests hold the two equal). A newly
 * saved main colour must read there too (adr/0062 §6).
 */
export const THEME_WELLS = {
  steel: "#eef1f4",
  warm: "#eeebe2",
  neutral: "#ececec",
  cool: "#e9ecf1",
} as const satisfies Record<ThemeBackground, string>

const HEX_COLOR = /^#[0-9a-f]{6}$/
const WHITE = "#ffffff"

/**
 * What the section's fields mean: 2 since Atölye applies every one of them
 * and Grafit is the default (adr/0062). A stored row without it was written
 * before, when the theme stood its own for most fields.
 */
export const THEME_SETTINGS_VERSION = 2

/** How the storefront looks (F18 D11, adr/0053): choices from fixed lists, no CSS; the style kit's (adr/0067). */
export interface ThemeSettings extends StyleKitSettings {
  /** Not a choice and not shown by the panel: see `THEME_SETTINGS_VERSION`. */
  settings_version: typeof THEME_SETTINGS_VERSION
  theme: (typeof INSTALLED_THEMES)[number]
  colors: {
    /**
     * Buttons, links, the announcement bar (`#rrggbb`); none: the
     * storefront section's `primary_color`, then the theme's own ink.
     */
    primary: string | null
    /** Badges and highlights; none: the theme's own. */
    accent: string | null
    background: ThemeBackground
  }
  typography: {
    heading: (typeof HEADING_FONTS)[number]
    body: (typeof BODY_FONTS)[number]
    /** The hand note's face (`ACCENT_FONTS`); absent (a row before it): `none`. */
    accent?: (typeof ACCENT_FONTS)[number]
  }
  radius: (typeof RADIUS_STEPS)[number]
  product_card: ProductCardSettings
  header: { layout: "centered" | "left"; sticky: boolean }
  buttons: "pill" | "rounded" | "square"
  /** The gap between the home page's sections, on the theme's own scale (`SECTION_SPACINGS`). */
  section_spacing: (typeof SECTION_SPACINGS)[number]
  /** How the theme draws its boxes (`SURFACE_STYLES`): a filled tone or a 1 px rule. */
  surface_style: (typeof SURFACE_STYLES)[number]
  /** A category, brand or collection page's own text at its foot (adr/0075). */
  listing_text: ListingTextSettings
  /** The search box's fields (adr/0077 §1). */
  search_form: SearchFormSettings
}

const color = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HEX_COLOR, { message: "platform_settings.color_invalid" })
  .nullable()

/**
 * Whether white text reads on the colour and the colour reads on the page
 * as the storefront paints that tone (`THEME_BACKGROUNDS`): WCAG AA for
 * large text and controls, 3:1 (§1.4.3, §1.4.11).
 */
export const primaryReadable = (primary: string, background: ThemeBackground): boolean =>
  contrastRatio(primary, WHITE) >= AA_LARGE_TEXT &&
  contrastRatio(primary, THEME_BACKGROUNDS[background]) >= AA_LARGE_TEXT

/**
 * Whether the colour also reads in the page colour's well, 3:1 (adr/0062
 * §6). Asked of a save that sets the colour or the page colour, never of a
 * stored row: a colour saved before this rule, within 3:1 of the page but
 * not of its well, keeps showing until the shop next changes either.
 */
export const primaryReadableInWell = (primary: string, background: ThemeBackground): boolean =>
  contrastRatio(primary, THEME_WELLS[background]) >= AA_LARGE_TEXT

/** A save that changes the main colour or the page colour to a pair the well cannot carry. */
export function themeSaveIssue(
  after: ThemeSettings,
  before: ThemeSettings
): { message: string; path: string[] } | null {
  const { primary, background } = after.colors
  const changed = primary !== before.colors.primary || background !== before.colors.background
  if (primary === null || !changed || primaryReadableInWell(primary, background)) {
    return null
  }
  return { message: "platform_settings.color_contrast", path: ["colors", "primary"] }
}

/**
 * The settings' starting values, today's Grafit look (adr/0062 §2): Manrope
 * for everything on the steel counter, soft corners, square cards with the
 * brand, the wordmark on the left of a sticky header, pill buttons. The
 * main colour is the theme's own until the shop picks one. The storefront's
 * `DEFAULT_THEME` is the same, and prints nothing for it.
 */
const GRAFIT: ThemeSettings = {
  settings_version: THEME_SETTINGS_VERSION,
  theme: "atolye",
  colors: { primary: null, accent: null, background: "steel" },
  typography: { heading: "manrope", body: "manrope" },
  radius: "soft",
  product_card: PRODUCT_CARD_DEFAULTS,
  header: { layout: "left", sticky: true },
  buttons: "pill",
  section_spacing: "normal",
  surface_style: "filled",
  listing_text: LISTING_TEXT_DEFAULTS,
  search_form: SEARCH_FORM_DEFAULTS,
  ...STYLE_KIT_DEFAULTS,
}

/**
 * Theme settings with the card's later fields (adr/0049 Ek 2026-11-14
 * §3.3) at their defaults where they are missing: a design's theme or a
 * preset written before them reads as it always drew (a `standard` card).
 * A card variant off the list (taken off since, or a newer build's) reads
 * as `standard` (§2.3). A settings row needs none of this: it is read over
 * the defaults.
 */
export function withCardDefaults(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  // The section spacing came later still (K-11): without it, the theme's own gaps
  if (!Object.hasOwn(value, "section_spacing")) {
    value = { ...value, section_spacing: GRAFIT.section_spacing }
  }
  // So did the surface style (Z-04): without it, today's filled boxes
  if (isPlainObject(value) && !Object.hasOwn(value, "surface_style")) {
    value = { ...value, surface_style: GRAFIT.surface_style }
  }
  // And the style kit (adr/0067): without a field, today's drawing; the listing text's too (adr/0075)
  value = withSearchFormDefaults(withListingTextDefaults(withStyleKitDefaults(value)))
  if (!isPlainObject(value) || !isPlainObject(value["product_card"])) {
    return value
  }
  const card = { ...GRAFIT.product_card, ...(upgradeCard(value["product_card"]) as object) }
  const listed: readonly unknown[] = PRODUCT_CARD_VARIANTS
  return {
    ...value,
    product_card: listed.includes(card.variant) ? card : { ...card, variant: "standard" },
  }
}

/** `group`'s own `keys`, for spreading over a default group; nothing from anything but an object. */
const kept = (group: unknown, keys: readonly string[]): Record<string, unknown> =>
  isPlainObject(group)
    ? Object.fromEntries(Object.entries(group).filter(([key]) => keys.includes(key)))
    : {}

/**
 * A row stored before adr/0062, read as the storefront drew it (§4). Atölye
 * then took the main colour, the cards' brand and shape and the sticky
 * header, and stood its own for the rest: so those stay, and what never
 * showed (accent, page colour, faces, corners, buttons, header layout, the
 * cards' rating) is Grafit's. A 4:5 card was drawn square. The row is
 * stored with the version at its next save; from then every field is the
 * shop's choice and this leaves it alone.
 */
export function upgradeStoredTheme(stored: Record<string, unknown>): Record<string, unknown> {
  if (Object.hasOwn(stored, "settings_version")) {
    // The card's `empty_stars` switch became the no-reviews choice (adr/0049 Ek 2026-11-15)
    const card = upgradeCard(stored["product_card"])
    return card === stored["product_card"] ? stored : { ...stored, product_card: card }
  }
  const card = kept(stored["product_card"], ["ratio", "show_brand"])
  if (card["ratio"] === "4:5") {
    delete card["ratio"]
  }
  return {
    ...stored,
    settings_version: THEME_SETTINGS_VERSION,
    colors: { ...GRAFIT.colors, ...kept(stored["colors"], ["primary"]) },
    typography: GRAFIT.typography,
    radius: GRAFIT.radius,
    product_card: { ...GRAFIT.product_card, ...card },
    header: { ...GRAFIT.header, ...kept(stored["header"], ["sticky"]) },
    buttons: GRAFIT.buttons,
  }
}

export const themeSection = defineSection<ThemeSettings>(
  "theme",
  {
    settings_version: z.literal(THEME_SETTINGS_VERSION),
    theme: z.preprocess(
      (value) => (typeof value === "string" ? (REMOVED_THEMES[value] ?? value) : value),
      z.enum(INSTALLED_THEMES)
    ),
    colors: z
      .object({
        primary: color,
        accent: color,
        background: z.enum(
          Object.keys(THEME_BACKGROUNDS) as [ThemeBackground, ...ThemeBackground[]]
        ),
      })
      .strict(),
    typography: z
      .object({
        heading: z.enum(HEADING_FONTS),
        body: z.enum(BODY_FONTS),
        accent: z.enum(ACCENT_FONTS).optional(),
      })
      .strict(),
    radius: z.enum(RADIUS_STEPS),
    product_card: productCardSchema,
    header: z.object({ layout: z.enum(["centered", "left"]), sticky: z.boolean() }).strict(),
    buttons: z.enum(["pill", "rounded", "square"]),
    section_spacing: z.enum(SECTION_SPACINGS),
    surface_style: z.enum(SURFACE_STYLES),
    listing_text: listingTextSchema,
    search_form: searchFormSchema,
    ...styleKitSchema,
  },
  GRAFIT,
  (values, ctx) => {
    const { primary, background } = values.colors
    // A malformed colour or page has its own issue already
    const checkable =
      typeof primary === "string" &&
      HEX_COLOR.test(primary) &&
      Object.hasOwn(THEME_BACKGROUNDS, background)
    if (checkable && !primaryReadable(primary, background)) {
      ctx.addIssue({
        code: "custom",
        message: "platform_settings.color_contrast",
        path: ["colors", "primary"],
      })
    }
  },
  upgradeStoredTheme,
  themeSaveIssue
)
