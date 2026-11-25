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

/** The longest words the shop may write in the words field before a search (`placeholder`). */
export const SEARCH_FORM_PLACEHOLDER_MAX = 60

/** The most categories the shop may name as tabs (`tabs`). */
export const SEARCH_FORM_TABS_MAX = 8

/** A category's URL handle as the tabs name one (lower-case words and hyphens). */
export const SEARCH_FORM_TAB_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** One category the shop names as a tab: its handle and, optionally, its small icon. */
export interface SearchFormTab {
  handle: string
  /**
   * Drawn before its name: a name off the sections' icon set
   * (`section-icons.ts`, read with `sectionIconOf`: one it does not know
   * is none); null: none.
   */
  icon: string | null
}

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
  /** The dates' "Esnek ay" field beside the two days (today's, on); off: the two days only. */
  flexible_month: boolean
  /**
   * An empty day written as words ("Tarih ekle") and a chosen one as
   * `GG.AA.YYYY`, instead of the browser's own date field (off, today's).
   * Only with JavaScript: without it the plain date fields stay.
   */
  date_words: boolean
  /**
   * Each field's label over its own light-filled box, the boxes apart
   * (today's off: the fields side by side with a hairline between them).
   */
  boxed_fields: boolean
  category_style: SearchFormCategoryStyle
  /**
   * The categories the box offers, in this order, each with its icon
   * (Wanderly's four tabs); empty (today's): the shop's top categories,
   * no icon. A handle the shop no longer has is left out.
   */
  tabs: SearchFormTab[]
  /**
   * The tabs' "Tümü" first (today's, on); off: the first tab stands chosen
   * and a search always names a category. Read only with `tabs` style.
   */
  tab_all: boolean
  /**
   * The words field's hint before a search ("Nereye gitmek istersiniz?");
   * null: the storefront's own ("Ürün, kategori veya marka ara").
   */
  placeholder: string | null
}

/** Every field on, no attribute named, categories in a drop-down. */
export const SEARCH_FORM_DEFAULTS: Readonly<SearchFormSettings> = {
  attribute_key: null,
  show_category: true,
  show_dates: true,
  show_people: true,
  flexible_month: true,
  date_words: false,
  boxed_fields: false,
  category_style: "select",
  tabs: [],
  tab_all: true,
  placeholder: null,
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
    flexible_month: flag(value?.flexible_month, SEARCH_FORM_DEFAULTS.flexible_month),
    date_words: flag(value?.date_words, SEARCH_FORM_DEFAULTS.date_words),
    boxed_fields: flag(value?.boxed_fields, SEARCH_FORM_DEFAULTS.boxed_fields),
    category_style: (SEARCH_FORM_CATEGORY_STYLES as readonly unknown[]).includes(style)
      ? (style as SearchFormCategoryStyle)
      : SEARCH_FORM_DEFAULTS.category_style,
    tabs: tabsOf(value?.tabs),
    tab_all: flag(value?.tab_all, SEARCH_FORM_DEFAULTS.tab_all),
    placeholder: hintOf(value?.placeholder),
  }
}

// An icon's name as the sections' set writes one (`section-icons.ts` holds the list)
const ICON_NAME = /^[a-z][a-z_]{0,31}$/

/** The named tabs: each well-formed handle once, at most the limit; an unknown icon none. */
function tabsOf(value: unknown): SearchFormTab[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const tabs: SearchFormTab[] = []
  for (const each of value as unknown[]) {
    const handle = (each as { handle?: unknown } | null)?.handle
    if (typeof handle === "string" && SEARCH_FORM_TAB_HANDLE.test(handle) && !seen.has(handle)) {
      seen.add(handle)
      const icon = (each as { icon?: unknown }).icon
      tabs.push({ handle, icon: typeof icon === "string" && ICON_NAME.test(icon) ? icon : null })
    }
  }
  return tabs.slice(0, SEARCH_FORM_TABS_MAX)
}

/** The shop's hint, trimmed and at most its length; empty or anything else: none. */
function hintOf(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : text.slice(0, SEARCH_FORM_PLACEHOLDER_MAX)
}
