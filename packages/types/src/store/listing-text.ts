/**
 * How a category, brand or collection page's own text looks at the foot
 * of the page, after its products (adr/0075): one theme setting for the
 * whole shop, in the theme's settings (`StoreThemeSettings.listing_text`),
 * drafted and published with the design (adr/0063 §3). The face is the
 * theme's body face; nothing here picks one. The backend mirrors the
 * lists and defaults (`platform-settings/sections/theme-listing-text.ts`,
 * a test keeps them equal); the panel names each step
 * `storefront.editor.theme.listingText.<field>.<step>`.
 *
 * Imports nothing at run time.
 */

/** The text's size: `sm` Küçük, `md` Normal (the default), `lg` Büyük. */
export const LISTING_TEXT_SIZES = ["sm", "md", "lg"] as const
export type ListingTextSize = (typeof LISTING_TEXT_SIZES)[number]

/** Its alignment: `start` from the reading side (the default), `center` centred. */
export const LISTING_TEXT_ALIGNS = ["start", "center"] as const
export type ListingTextAlign = (typeof LISTING_TEXT_ALIGNS)[number]

/** Its measure: `narrow` a reading measure (the default), `wide` the page's content width. */
export const LISTING_TEXT_WIDTHS = ["narrow", "wide"] as const
export type ListingTextWidth = (typeof LISTING_TEXT_WIDTHS)[number]

export interface ListingTextSettings {
  size: ListingTextSize
  align: ListingTextAlign
  width: ListingTextWidth
  /**
   * A long text shows its first lines and a "Devamını oku" button; the
   * whole text stays in the page's HTML either way (SEO, adr/0075 §7).
   */
  collapse: boolean
}

/** Each setting's default: normal size, from the start, a reading measure, collapsed. */
export const LISTING_TEXT_DEFAULTS: Readonly<ListingTextSettings> = {
  size: "md",
  align: "start",
  width: "narrow",
  collapse: true,
}

const listed = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  (list as readonly unknown[]).includes(value) ? (value as T) : fallback

/**
 * The settings as the storefront applies them: each missing or unknown
 * value at its default (a backend before adr/0075 sends none).
 */
export function listingTextOf(
  value: Partial<Record<keyof ListingTextSettings, unknown>> | null | undefined
): ListingTextSettings {
  return {
    size: listed(LISTING_TEXT_SIZES, value?.size, LISTING_TEXT_DEFAULTS.size),
    align: listed(LISTING_TEXT_ALIGNS, value?.align, LISTING_TEXT_DEFAULTS.align),
    width: listed(LISTING_TEXT_WIDTHS, value?.width, LISTING_TEXT_DEFAULTS.width),
    collapse:
      typeof value?.collapse === "boolean" ? value.collapse : LISTING_TEXT_DEFAULTS.collapse,
  }
}
