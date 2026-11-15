import {
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_SOLD_OUT_ROWS,
  CARD_VARIANTS,
  SECTION_SPACINGS,
} from "@qticaret/types"
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
export const RADII = ["sharp", "soft", "round"] as const
export const CARD_RATIOS = ["4:5", "1:1", "3:4"] as const
/** How cards are drawn (adr/0049 Ek 2026-11-14 §3.3): the contract's list; a rail may pick its own. */
export { CARD_VARIANTS }
/** The framed card's switches (E5), each the theme setting's wherever a framed card shows. */
export const FRAMED_CARD_SWITCHES = ["hover_image", "delivery_note", "full_button"] as const
/** The pills on every card's photo (adr/0049 Ek 2026-11-15, decision a), each on or off. */
export const CARD_BADGE_SWITCHES = ["sale_badge", "low_stock_badge", "sold_out_badge"] as const
/**
 * A sold-out card's price row, the stars without reviews, the framed
 * card's foot button (decisions b, c, d): the contract's lists.
 */
export { CARD_BUTTON_STYLES, CARD_NO_REVIEWS, CARD_SOLD_OUT_ROWS }
export const HEADER_LAYOUTS = ["centered", "left"] as const
export const BUTTON_SHAPES = ["pill", "rounded", "square"] as const
/** The gap between sections, theme-wide (Tezgâh audit K-11): the contract's list, `normal` the theme's own. */
export { SECTION_SPACINGS }

export type HeadingFont = (typeof HEADING_FONTS)[number]
export type BodyFont = (typeof BODY_FONTS)[number]

export interface ThemeSettings {
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
    sold_out_row: (typeof CARD_SOLD_OUT_ROWS)[number]
    no_reviews: (typeof CARD_NO_REVIEWS)[number]
    button_style: (typeof CARD_BUTTON_STYLES)[number]
  } & Record<(typeof FRAMED_CARD_SWITCHES)[number] | (typeof CARD_BADGE_SWITCHES)[number], boolean>
  header: { layout: (typeof HEADER_LAYOUTS)[number]; sticky: boolean }
  buttons: (typeof BUTTON_SHAPES)[number]
  section_spacing: (typeof SECTION_SPACINGS)[number]
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
  },
  header: { layout: "left", sticky: true },
  buttons: "pill",
  section_spacing: "normal",
}

/**
 * Heading faces whose files carry no ₺ (storefront `app/fonts.css`): prices
 * are drawn in the body face, a ₺ typed into a heading in a fallback face
 * (adr/0062 §7, owner's decision 3). The form says so under the choice.
 */
export const NO_LIRA_FONTS: ReadonlySet<HeadingFont> = new Set(["playfair", "dm-serif"])

/** Faces with one weight (400): headings are drawn regular, not bold (adr/0062 §7). */
export const SINGLE_WEIGHT_FONTS: ReadonlySet<HeadingFont> = new Set(["dm-serif"])

/**
 * Header layouts the theme does not draw yet: "centered" is built on its
 * own branch and reaches the storefront once the owner approves it
 * (adr/0062 §10, owner's decision 6). Until then the theme draws "left",
 * so the form shows the choice as in preparation and does not offer it.
 */
export const UNBUILT_HEADER_LAYOUTS: ReadonlySet<ThemeSettings["header"]["layout"]> = new Set([
  "centered",
])
