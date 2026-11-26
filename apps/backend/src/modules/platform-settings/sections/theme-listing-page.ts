import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "./define"

/**
 * How a listing page lays out its products and its trail: one theme
 * setting for the whole shop, a group of the theme section
 * (`listing_page`), drafted and published with the design. Mirrors
 * `@qticaret/types`' `listing-page.ts` (a unit test keeps them equal).
 * Every default is the page as it was drawn before it (adr/0066).
 */
export const LISTING_PAGE = {
  default_view: ["grid", "list"],
  view_switch: ["show", "hide"],
  breadcrumb_current: ["show", "hide"],
} as const satisfies Record<string, readonly [string, ...string[]]>

/** The longest word after the count (`@qticaret/types`' `LISTING_COUNT_WORD_MAX`). */
export const LISTING_COUNT_WORD_MAX = 24

export interface ListingPageSettings {
  default_view: (typeof LISTING_PAGE.default_view)[number]
  view_switch: (typeof LISTING_PAGE.view_switch)[number]
  breadcrumb_current: (typeof LISTING_PAGE.breadcrumb_current)[number]
  /** The word after the count ("tur"); none: the page's own "ürün". */
  count_word: string | null
}

/** A grid, no switch, the trail to the page itself, the count in products: today's page. */
export const LISTING_PAGE_DEFAULTS: Readonly<ListingPageSettings> = {
  default_view: "grid",
  view_switch: "hide",
  breadcrumb_current: "show",
  count_word: null,
}

/** The group's schema: a step on its list only, every field present. */
export const listingPageSchema = z
  .object({
    default_view: z.enum(LISTING_PAGE.default_view),
    view_switch: z.enum(LISTING_PAGE.view_switch),
    breadcrumb_current: z.enum(LISTING_PAGE.breadcrumb_current),
    count_word: z.string().trim().min(1).max(LISTING_COUNT_WORD_MAX).nullable(),
  })
  .strict()

/**
 * Theme settings with the group at its defaults where it or a field of it
 * is missing: a design's theme, a preset or a panel save written before
 * it reads as the defaults. A value off a list is kept, for the schema to
 * refuse.
 */
export function withListingPageDefaults(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  const group = value["listing_page"]
  if (group !== undefined && !isPlainObject(group)) {
    return value
  }
  return { ...value, listing_page: { ...LISTING_PAGE_DEFAULTS, ...group } }
}
