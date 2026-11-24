import {
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_SOLD_OUT_ROWS,
  CARD_TEXT_POSITIONS,
  CARD_VARIANTS,
  LISTING_TEXT_ALIGNS,
  LISTING_TEXT_DEFAULTS,
  LISTING_TEXT_SIZES,
  LISTING_TEXT_WIDTHS,
  RADIUS_STEPS,
  SEARCH_FORM_CATEGORY_STYLES,
  SEARCH_FORM_DEFAULTS,
  SECTION_SPACINGS,
  STYLE_KIT,
  STYLE_KIT_DEFAULTS,
  SURFACE_STYLES,
} from "@qticaret/types"
import type { ListingTextSettings, SearchFormSettings, StyleKit } from "@qticaret/types"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontBackground } from "@/theme/storefront"

/**
 * The storefront's theme settings (F18 D11, adr/0053, adr/0062; backend
 * `platform-settings/sections/theme.ts`): choices from fixed lists, no CSS
 * and no font address. The Atölye theme applies every one of them. Since
 * adr/0063 §3 they are part of the design's draft (`LayoutSettings.theme`)
 * and go live with "Yayınla"; the section is what the design falls back
 * to until the shop writes them there.
 */

/** Self-hosted faces the storefront has a loader for; names only. */
export const HEADING_FONTS = ["fraunces", "inter", "playfair", "dm-serif", "manrope"] as const
export const BODY_FONTS = ["inter", "manrope", "source-sans", "nunito"] as const
export const BACKGROUNDS = [
  "steel",
  "warm",
  "neutral",
  "cool",
] as const satisfies StorefrontBackground[]
/** The corners, sharpest first (adr/0067 Ek 2026-11-16 added `crisp` and `gentle`): the contract's list. */
export const RADII = RADIUS_STEPS
export const CARD_RATIOS = ["4:5", "1:1", "3:4"] as const
/** How cards are drawn (adr/0049 Ek 2026-11-14 §3.3): the contract's list; a rail may pick its own. */
export { CARD_VARIANTS }
/**
 * The framed card's switches (E5), each the theme setting's wherever a
 * framed card shows. The second photo on hover (`hover_image`) was one;
 * every card's since sahip 2026-11-18.
 */
export const FRAMED_CARD_SWITCHES = ["delivery_note", "full_button"] as const
/** The pills on every card's photo (adr/0049 Ek 2026-11-15, decision a), each on or off. */
export const CARD_BADGE_SWITCHES = ["sale_badge", "low_stock_badge", "sold_out_badge"] as const
/**
 * A sold-out card's price row, the stars without reviews, the framed
 * card's foot button (decisions b, c, d): the contract's lists.
 */
export { CARD_BUTTON_STYLES, CARD_NO_REVIEWS, CARD_SOLD_OUT_ROWS }
/** The quick view button's look (adr/0049 Ek 2026-11-15): the contract's list. */
export { CARD_QUICK_VIEW_TRIGGERS }
/** What the quick view dialog shows besides the photos, name, price and options, each on or off. */
export const QUICK_VIEW_SWITCHES = [
  "quick_view_rating",
  "quick_view_summary",
  "quick_view_quantity",
] as const
/**
 * The tour card's look (adr/0077 Ek "tur kartı"): where a standard card's
 * words stand, the contract's list; the stars' pill and the arrow, each a
 * switch; a dated card's length row and "kişi başı", each a switch shown
 * only while the shop sells dated products.
 */
export { CARD_TEXT_POSITIONS }
export const TOUR_CARD_SWITCHES = ["rating_badge", "arrow"] as const
export const DATED_CARD_SWITCHES = ["duration_row", "per_person"] as const
export const HEADER_LAYOUTS = ["centered", "left"] as const
export const BUTTON_SHAPES = ["pill", "rounded", "square"] as const
/** The gap between sections, theme-wide (Tezgâh audit K-11): the contract's list, `normal` the theme's own. */
export { SECTION_SPACINGS }
/** How the theme's boxes stand (Tezgâh audit Z-04): the contract's list, `filled` today's tone. */
export { SURFACE_STYLES }
/** The style kit (adr/0067 §1): menu items, shadow, chips, the photos' ground, density, motion; first step the default. */
export { STYLE_KIT }
/**
 * A category, brand or collection page's text at its foot (adr/0075 §6):
 * its size, alignment and measure, the contract's lists; whether a long
 * one folds is a switch.
 */
export { LISTING_TEXT_ALIGNS, LISTING_TEXT_SIZES, LISTING_TEXT_WIDTHS }
/** The search box's categories as a drop-down or as tabs (adr/0077 §1). */
export { SEARCH_FORM_CATEGORY_STYLES }

export type HeadingFont = (typeof HEADING_FONTS)[number]
export type BodyFont = (typeof BODY_FONTS)[number]

export interface ThemeSettings extends StyleKit {
  /**
   * What the fields mean (adr/0062 §4): the server's own, read with the
   * section and never sent. A row stored before it reads as Grafit already.
   */
  settings_version: 2
  /** The installed theme; one today (`atolye`, adr/0057). */
  theme: "atolye"
  colors: {
    /** Buttons and links (`#rrggbb`); none: the storefront's old main colour, then the theme's wine. */
    primary: string | null
    /** Info badges, the selected chip and highlights; none: the main colour. Not contrast-checked. */
    accent: string | null
    background: StorefrontBackground
  }
  typography: { heading: HeadingFont; body: BodyFont }
  radius: (typeof RADII)[number]
  product_card: {
    ratio: (typeof CARD_RATIOS)[number]
    show_brand: boolean
    show_rating: boolean
    variant: (typeof CARD_VARIANTS)[number]
    /** The product's second photo on hover, every card's (sahip 2026-11-18). */
    hover_image: boolean
    sold_out_row: (typeof CARD_SOLD_OUT_ROWS)[number]
    no_reviews: (typeof CARD_NO_REVIEWS)[number]
    button_style: (typeof CARD_BUTTON_STYLES)[number]
    /** The quick view (adr/0049 Ek 2026-11-15): off by default, as cards were. */
    quick_view: boolean
    quick_view_trigger: (typeof CARD_QUICK_VIEW_TRIGGERS)[number]
    /** A standard card's words under or over its photo (adr/0077 Ek "tur kartı"). */
    text_position: (typeof CARD_TEXT_POSITIONS)[number]
  } & Record<
    | (typeof FRAMED_CARD_SWITCHES)[number]
    | (typeof CARD_BADGE_SWITCHES)[number]
    | (typeof QUICK_VIEW_SWITCHES)[number]
    | (typeof TOUR_CARD_SWITCHES)[number]
    | (typeof DATED_CARD_SWITCHES)[number],
    boolean
  >
  header: { layout: (typeof HEADER_LAYOUTS)[number]; sticky: boolean }
  buttons: (typeof BUTTON_SHAPES)[number]
  section_spacing: (typeof SECTION_SPACINGS)[number]
  surface_style: (typeof SURFACE_STYLES)[number]
  /** The listing pages' text at their foot (adr/0075 §6); the server fills a missing group. */
  listing_text: ListingTextSettings
  /** The search box's fields (adr/0077 §1); the server fills a missing group. */
  search_form: SearchFormSettings
}

export const THEME_SECTION = "theme"

export const themeQuery = () => sectionQuery<ThemeSettings>(THEME_SECTION)

/** Whether each face is a serif: shown beside its name (`storefront.editor.theme.fonts.*`). */
export const SERIF_FONTS: ReadonlySet<HeadingFont | BodyFont> = new Set([
  "fraunces",
  "playfair",
  "dm-serif",
])

/** What the form holds and sends: every choice, without the server's own fields. */
export type ThemeChoices = Omit<ThemeSettings, "theme" | "settings_version">

/**
 * Grafit, the look the theme draws with nothing chosen (adr/0062 §2;
 * backend `themeSection`'s defaults and the storefront's `DEFAULT_THEME`):
 * the panel's one copy, what "Grafit'e dön" puts back.
 */
export const GRAFIT_THEME: ThemeChoices = {
  colors: { primary: null, accent: null, background: "steel" },
  typography: { heading: "manrope", body: "manrope" },
  radius: "soft",
  product_card: {
    ratio: "1:1",
    show_brand: true,
    show_rating: false,
    variant: "standard",
    hover_image: true,
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
 * Heading faces whose files carry no ₺ (storefront `app/fonts.css`): prices
 * are drawn in the body face, a ₺ typed into a heading in a fallback face
 * (adr/0062 §7, owner's decision 3). The form says so under the choice.
 */
export const NO_LIRA_FONTS: ReadonlySet<HeadingFont> = new Set(["playfair", "dm-serif"])

/** Faces with one weight (400): headings are drawn regular, not bold (adr/0062 §7). */
export const SINGLE_WEIGHT_FONTS: ReadonlySet<HeadingFont> = new Set(["dm-serif"])
