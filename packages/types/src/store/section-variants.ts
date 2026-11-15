/**
 * Section variants (adr/0049 Ek 2026-11-14 §2): how a section type may be
 * drawn, a closed list per type whose first is the drawing from before
 * variants and the default. The contract's list: a new variant goes here
 * first, then into the backend's schema (`lib/storefront/sections/
 * variants.ts`, a mirror a test keeps equal), then into the themes. Names
 * are English, sector-free and say what is drawn; the panel's Turkish
 * names are `storefront.editor.variants.<type>.<variant>`.
 */
export const SECTION_VARIANTS = {
  /** `strip`: today's tinted strip; `lined`: boxes split by hairlines (GB4). */
  trust_badges: ["strip", "lined"],
  /**
   * `standard`: today's graphite opening; `category_list`: the category
   * list, the opening's tile and two category tiles side by side (H17).
   */
  hero: ["standard", "category_list"],
  /**
   * `tiles`: today's picture tiles; `linked`: each category a card with its
   * first subcategories as links (adr/0049 Ek 2026-11-15).
   */
  categories: ["tiles", "linked"],
  /**
   * The product rail (adr/0049 Ek 2026-11-15): `grid`, today's rows of
   * cards; `carousel`, one row that slides (the scroller kit,
   * `section-scroller`); `featured`, one large card beside two rows of
   * three small ones; `compact`, small side-by-side cards three across;
   * `columns`, two or three lists side by side, each its own title and
   * source, in small cards. Counts by variant: `section-shelf`.
   */
  products: ["grid", "carousel", "featured", "compact", "columns"],
  /**
   * The main sections (adr/0049 Ek 2026-11-14 §5, §7), each with today's
   * drawing first. The header bar's `centered` is the theme setting's
   * centred header (`header.layout`), read into the bar by name; its
   * `catalog` (N14) a utility strip, a wide search with the shop's phone and
   * a filled menu bar with a "Kategoriler" button.
   */
  header_bar: ["standard", "centered", "catalog"],
  footer_bar: ["ledger"],
  product_main: ["standard"],
  category_main: ["standard"],
} as const satisfies Record<string, readonly [string, ...string[]]>

/**
 * The catalog header's menu bar ground (adr/0049 Ek 2026-11-15, N14):
 * "Koyu / Ana renk / Açık", the marquee's names; the first the default.
 * Mirrored by the backend's `HEADER_MENU_GROUNDS`.
 */
export const HEADER_MENU_GROUNDS = ["stage", "primary", "light"] as const

export type HeaderMenuGround = (typeof HEADER_MENU_GROUNDS)[number]

/** The catalog header's words: the search box's placeholder. Mirrored by the backend. */
export const HEADER_CATALOG_LIMITS = { search_placeholder: 60 } as const

/**
 * How a product card is drawn (adr/0049 Ek 2026-11-14 §3.3, owner's
 * decision 4): the theme setting's `product_card.variant` everywhere, a
 * product rail's `card_variant` over it. `standard`: today's card;
 * `framed`: a bordered box with the add button across its foot (UK5);
 * `compact` (Ek 2026-11-15): a small side-by-side card (photo left, name,
 * stars, price), no add button, the whole card one link. A `compact` or
 * `columns` rail draws its cards compact whatever is set.
 * Mirrored by the backend's `PRODUCT_CARD_VARIANTS`.
 */
export const CARD_VARIANTS = ["standard", "framed", "compact"] as const

export type CardVariant = (typeof CARD_VARIANTS)[number]

/** A card variant as a reader takes it: one on the list as it is, anything else `standard`. */
export const cardVariantOf = (value: unknown): CardVariant =>
  CARD_VARIANTS.find((each) => each === value) ?? CARD_VARIANTS[0]

export type VariantSectionType = keyof typeof SECTION_VARIANTS
export type SectionVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][number]
export type DefaultVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][0]

export type TrustBadgesVariant = SectionVariant<"trust_badges">
export type HeroVariant = SectionVariant<"hero">
export type CategoriesVariant = SectionVariant<"categories">
export type ProductsVariant = SectionVariant<"products">
export type HeaderBarVariant = SectionVariant<"header_bar">
export type FooterBarVariant = SectionVariant<"footer_bar">
export type ProductMainVariant = SectionVariant<"product_main">
export type CategoryMainVariant = SectionVariant<"category_main">

export const isVariantType = (type: string): type is VariantSectionType =>
  Object.hasOwn(SECTION_VARIANTS, type)

/** The type's default variant: what a section without one, or with one not known here, is. */
export const defaultVariant = <T extends VariantSectionType>(type: T): DefaultVariant<T> =>
  SECTION_VARIANTS[type][0]

/** Whether the type offers a choice: the panel shows its "Biçim" only then. */
export function hasVariants(type: string): type is VariantSectionType {
  if (!isVariantType(type)) {
    return false
  }
  // A type keeps its list when a variant is taken off, so one may be left
  const listed: readonly string[] = SECTION_VARIANTS[type]
  return listed.length > 1
}

/**
 * A section's variant as a reader takes it (forgiving on reading, §2.3):
 * one on the type's list as it is; none, or one this build does not know
 * (a newer backend's), the type's default.
 */
export function variantOf<T extends VariantSectionType>(
  type: T,
  variant: unknown
): SectionVariant<T> {
  const listed: readonly unknown[] = SECTION_VARIANTS[type]
  return listed.includes(variant) ? (variant as SectionVariant<T>) : defaultVariant(type)
}
