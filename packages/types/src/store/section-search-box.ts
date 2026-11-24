/**
 * The search box section (`search_box`, adr/0077 §1): an optional title
 * and intro over the shop's one search box. Its fields are not the
 * section's but the theme's (`StoreThemeSettings.search_form`), so the
 * box reads the same wherever it stands; its ground and alignment are the
 * section look's (`look.ground`, `look.align`). Sector-free. The backend
 * mirrors the limits (`lib/storefront/sections/search-box.ts`, a test
 * keeps them equal).
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-search-box` subpath).
 */

/** Each part's longest text. */
export const SEARCH_BOX_LIMITS = {
  intro: 240,
} as const

/** The search box section in `GET /store/storefront-layout`. */
export interface StoreSearchBoxSection {
  id: string
  type: "search_box"
  /** None: no heading (the form is named for screen readers by the storefront). */
  title: string | null
  intro: string | null
}
