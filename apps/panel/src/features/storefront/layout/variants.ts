import {
  CATEGORY_CARD_DEFAULTS,
  HERO_CATALOG_LIMITS,
  SCROLLER_DEFAULTS,
  SHELF_LIMITS,
  SHELF_PHONE_DEFAULT,
  hasVariants,
} from "@qticaret/types"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"
import type { AnySection, HeaderCatalogFields } from "@/features/storefront/api/layout"

/** A bar switched to the catalog header starts from the backend's defaults (adr/0049 Ek 2026-11-15). */
export const HEADER_CATALOG_DEFAULTS: Readonly<HeaderCatalogFields> = {
  search_placeholder: null,
  search_label: false,
  account_text: true,
  cart_total: false,
  highlight_link: null,
  utility_bar: true,
  phone: true,
  categories_button: true,
  menu_ground: "stage",
}

/** A section whose type is drawn more than one way (adr/0049 Ek 2026-11-14 §2). */
export type VariantSection = Extract<AnySection, { type: VariantSectionType }>

/**
 * Each variant's own fields as a section switched to it starts them; what
 * is common to the type (title, text, buttons, picture) is not here and
 * stays as written. A variant with no fields of its own has none.
 */
export const VARIANT_FIELDS: {
  readonly [T in VariantSectionType]: Readonly<Record<SectionVariant<T>, Readonly<object>>>
} = {
  trust_badges: { strip: {}, lined: {} },
  // H17's own fields as a switched opening starts them: the top categories with counts
  hero: {
    standard: {},
    category_list: {
      list: { kind: "top" },
      list_limit: HERO_CATALOG_LIMITS.list.default,
      show_count: true,
      tiles: [],
      chips: [],
      picks: [],
      show_price: true,
    },
  },
  // The linked cards start from the contract's defaults (adr/0049 Ek 2026-11-15)
  categories: { tiles: {}, linked: CATEGORY_CARD_DEFAULTS },
  // A rail's own by variant (Ek 2026-11-15): a columns rail starts one more list, the newest
  products: {
    grid: { columns: 3, columns_mobile: SHELF_PHONE_DEFAULT },
    carousel: { scroller: SCROLLER_DEFAULTS },
    featured: {},
    compact: { rows: SHELF_LIMITS.compact.default },
    columns: {
      per_list: SHELF_LIMITS.columns.default,
      lists: [{ title: null, source: { kind: "newest" } }],
    },
  },
  // The related products as a rail's grid or carousel (bilesen-denetimi (b) 7)
  related_products: {
    grid: { columns: 3, columns_mobile: SHELF_PHONE_DEFAULT },
    carousel: { scroller: SCROLLER_DEFAULTS },
  },
  header_bar: { standard: {}, centered: {}, catalog: HEADER_CATALOG_DEFAULTS },
  footer_bar: { ledger: {} },
  product_main: { standard: {} },
  category_main: { standard: {} },
}

/**
 * A variant's own fields a section holds only once the shop sets them (no
 * default to start from): dropped with the rest when it leaves the variant.
 * H17's slides are the opening's; the common fields keep the first one's.
 */
const OPTIONAL_FIELDS: {
  readonly [T in VariantSectionType]?: Readonly<
    Partial<Record<SectionVariant<T>, readonly string[]>>
  >
} = {
  hero: { category_list: ["slides", "scroller"] },
}

/**
 * Variants on the list the theme does not draw yet: shown, not offered
 * (as the theme settings' "Ortada" was, adr/0062 karar 6). A section saved
 * with one keeps it; the storefront draws the default meanwhile. None
 * today: the header bar's `centered` is drawn since 2026-11-15.
 */
export const UNBUILT_VARIANTS: {
  readonly [T in VariantSectionType]?: ReadonlySet<SectionVariant<T>>
} = {}

export const isUnbuilt = <T extends VariantSectionType>(type: T, variant: SectionVariant<T>) =>
  (UNBUILT_VARIANTS[type] as ReadonlySet<string> | undefined)?.has(variant) ?? false

/** Whether the panel offers the section's "Biçim": its type is drawn more than one way. */
export const offersVariants = (section: AnySection): section is VariantSection =>
  hasVariants(section.type) && "variant" in section

/**
 * The section drawn another way (§2.4, option B): its common fields carried
 * over, its old variant's own fields dropped and the new one's started from
 * their defaults. One step in the editor's history, so "Geri al" brings the
 * old variant back with what was written in it.
 */
export function switchVariant<S extends VariantSection>(
  section: S,
  next: SectionVariant<S["type"]>
): S {
  const fields: Readonly<Record<string, object>> = VARIANT_FIELDS[section.type]
  const optional: Readonly<Record<string, readonly string[]>> = OPTIONAL_FIELDS[section.type] ?? {}
  const own = new Set([
    ...Object.keys(fields[section.variant] ?? {}),
    ...(optional[section.variant] ?? []),
  ])
  const kept = Object.fromEntries(Object.entries(section).filter(([key]) => !own.has(key)))
  return { ...kept, ...structuredClone(fields[next] ?? {}), variant: next } as S
}
