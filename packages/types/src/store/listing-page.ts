/**
 * How a listing page (`/magaza`, a category, brand, collection or landing
 * page, the sale page) lays out its products: one theme setting for the
 * whole shop, in the theme's settings (`StoreThemeSettings.listing_page`),
 * drafted and published with the design (adr/0063 §3). Every default is
 * the page as it was drawn before it (adr/0066). The backend mirrors the
 * lists and defaults (`platform-settings/sections/theme-listing-page.ts`,
 * a test keeps them equal); the panel names each step
 * `storefront.editor.theme.listingPage.<field>.<step>`.
 *
 * Imports nothing at run time.
 */

/** The products as a grid of cards (`grid`, the default) or one per row (`list`). */
export const LISTING_VIEWS = ["grid", "list"] as const
export type ListingViewMode = (typeof LISTING_VIEWS)[number]

/** Whether the shopper may switch between the two (`show`) or not (`hide`, the default). */
export const LISTING_VIEW_SWITCHES = ["show", "hide"] as const
export type ListingViewSwitch = (typeof LISTING_VIEW_SWITCHES)[number]

/**
 * Whether the trail ends with the page itself (`show`, the default) or
 * stops at its parent (`hide`), the title under it naming the page. The
 * page's `BreadcrumbList` data keeps it either way (docs/13).
 */
export const LISTING_BREADCRUMB_CURRENTS = ["show", "hide"] as const
export type ListingBreadcrumbCurrent = (typeof LISTING_BREADCRUMB_CURRENTS)[number]

export interface ListingPageSettings {
  default_view: ListingViewMode
  view_switch: ListingViewSwitch
  breadcrumb_current: ListingBreadcrumbCurrent
}

/** Each setting's default: today's page, a grid with no switch, the trail to the page itself. */
export const LISTING_PAGE_DEFAULTS: Readonly<ListingPageSettings> = {
  default_view: "grid",
  view_switch: "hide",
  breadcrumb_current: "show",
}

/** The shopper's choice in the page's address (`?gorunum=liste`); the grid writes none. */
export const LISTING_VIEW_PARAM = "gorunum"
export const LISTING_VIEW_WORDS: Readonly<Record<ListingViewMode, string>> = {
  grid: "izgara",
  list: "liste",
}

const listed = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  (list as readonly unknown[]).includes(value) ? (value as T) : fallback

/**
 * The settings as the storefront applies them: each missing or unknown
 * value at its default (a backend before them sends none).
 */
export function listingPageOf(
  value: Partial<Record<keyof ListingPageSettings, unknown>> | null | undefined
): ListingPageSettings {
  return {
    default_view: listed(LISTING_VIEWS, value?.default_view, LISTING_PAGE_DEFAULTS.default_view),
    view_switch: listed(
      LISTING_VIEW_SWITCHES,
      value?.view_switch,
      LISTING_PAGE_DEFAULTS.view_switch
    ),
    breadcrumb_current: listed(
      LISTING_BREADCRUMB_CURRENTS,
      value?.breadcrumb_current,
      LISTING_PAGE_DEFAULTS.breadcrumb_current
    ),
  }
}
