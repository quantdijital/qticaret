/**
 * The search box's fields (adr/0077 §1): one theme setting for the whole
 * shop, in the theme's settings (`StoreThemeSettings.search_form`), drafted
 * and published with the design (adr/0063 §3). The same box stands in a
 * `search_box` section, on top of `/arama` and (later) in a full-picture
 * hero. Sector-free: the "where" field is whichever filterable choice
 * attribute the shop names (`attribute_key`; a travel shop's
 * `gidilecek_yer`), the "what" field the shop's categories. The dates and
 * the party are drawn only while the shop sells dated products
 * (`catalog.booking`), whatever these say. The backend mirrors the lists
 * and defaults (`platform-settings/sections/theme-search-form.ts`, a test
 * keeps them equal); the panel names each field
 * `storefront.editor.theme.searchForm.<field>`.
 *
 * Imports nothing at run time.
 */

/** How the categories are offered: `select` a drop-down (the default), `tabs` tabs over the bar. */
export const SEARCH_FORM_CATEGORY_STYLES = ["select", "tabs"] as const
export type SearchFormCategoryStyle = (typeof SEARCH_FORM_CATEGORY_STYLES)[number]

/** An attribute key as the listing reads one in its address (adr/0013). */
export const SEARCH_FORM_ATTRIBUTE_KEY = /^[a-z][a-z0-9_]{0,63}$/

export interface SearchFormSettings {
  /**
   * The filterable choice attribute whose values fill the "where" field;
   * null: no such field (a words field stands in its place).
   */
  attribute_key: string | null
  show_category: boolean
  /** Dated products only: two days (a range) or a flexible month. */
  show_dates: boolean
  /** Dated products only: places the party takes (`kisi`). */
  show_people: boolean
  category_style: SearchFormCategoryStyle
}

/** Every field on, no attribute named, categories in a drop-down. */
export const SEARCH_FORM_DEFAULTS: Readonly<SearchFormSettings> = {
  attribute_key: null,
  show_category: true,
  show_dates: true,
  show_people: true,
  category_style: "select",
}

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

/**
 * The settings as the storefront applies them: each missing or unknown
 * value at its default (a backend before adr/0077 sends none).
 */
export function searchFormOf(
  value: Partial<Record<keyof SearchFormSettings, unknown>> | null | undefined
): SearchFormSettings {
  const key = value?.attribute_key
  const style = value?.category_style
  return {
    attribute_key:
      typeof key === "string" && SEARCH_FORM_ATTRIBUTE_KEY.test(key)
        ? key
        : SEARCH_FORM_DEFAULTS.attribute_key,
    show_category: flag(value?.show_category, SEARCH_FORM_DEFAULTS.show_category),
    show_dates: flag(value?.show_dates, SEARCH_FORM_DEFAULTS.show_dates),
    show_people: flag(value?.show_people, SEARCH_FORM_DEFAULTS.show_people),
    category_style: (SEARCH_FORM_CATEGORY_STYLES as readonly unknown[]).includes(style)
      ? (style as SearchFormCategoryStyle)
      : SEARCH_FORM_DEFAULTS.category_style,
  }
}
