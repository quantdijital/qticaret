import {
  BANNER_SPLIT_EDGES,
  CATEGORY_CARD_DEFAULTS,
  CATEGORY_COLLAGE_DEFAULTS,
  CATEGORY_PANELS_DEFAULTS,
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_ROWS_DEFAULTS,
  FOOTER_ROWS_START,
  HERO_CATALOG_LIMITS,
  SCROLLER_DEFAULTS,
  SHELF_LIMITS,
  SHELF_PHONE_DEFAULT,
  SHELF_RANKED_LAYOUT_DEFAULT,
  SHELF_STAGE_DEFAULTS,
  SHELF_STRIPS_DEFAULTS,
  RICH_TEXT_IMAGE_SIDE_DEFAULT,
  SECTION_VARIANTS,
  hasVariants,
  newsletterOnPage,
  richTextInFooter,
  richTextOffPages,
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
  tools_place: "bar",
  top_links: "strip",
  search_width: "wide",
  strip_note: null,
  strip_note_link: null,
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
  categories: {
    tiles: {},
    linked: CATEGORY_CARD_DEFAULTS,
    collage: CATEGORY_COLLAGE_DEFAULTS,
    panels: CATEGORY_PANELS_DEFAULTS,
  },
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
    // Ek 2026-11-16: five strips, the shared look's defaults
    strips: { strips_count: SHELF_LIMITS.strips.default, ...SHELF_STRIPS_DEFAULTS },
    // Ek 2026-11-16: five places, the first large
    ranked: {
      ranked_count: SHELF_LIMITS.ranked.default,
      ranked_layout: SHELF_RANKED_LAYOUT_DEFAULT,
    },
    // Ek 2026-11-16: four products, the stage on the left in graphite, following the list
    stage_list: { stage_count: SHELF_LIMITS.stage_list.default, ...SHELF_STAGE_DEFAULTS },
  },
  // The related products as a rail's grid or carousel (bilesen-denetimi (b) 7)
  related_products: {
    grid: { columns: 3, columns_mobile: SHELF_PHONE_DEFAULT },
    carousel: { scroller: SCROLLER_DEFAULTS },
  },
  header_bar: { standard: {}, centered: {}, catalog: HEADER_CATALOG_DEFAULTS },
  // Ek 2026-11-17: the strip on, no line about the shop, the steel well, the marks on cards
  // adr/0070: the free rows footer's ground and marks; its rows are the backend's starting row
  footer_bar: {
    ledger: {},
    brand_columns: FOOTER_COLUMNS_DEFAULTS,
    free_rows: { ...FOOTER_ROWS_DEFAULTS, rows: FOOTER_ROWS_START },
  },
  // Ek 2026-11-17 e-bülten: the promise line shown in the storefront's words, no picture yet;
  // the line beside the heading is every variant's and stays as written
  newsletter: {
    standard: {},
    split: { note: null, show_note: true },
    image_card: { note: null, show_note: true, image: null },
    strip: {},
    in_footer: {},
  },
  // adr/0073 §3: no picture yet (the draft waits for one), on the left; title and text stay
  rich_text: {
    pane: {},
    with_image: { image: null, image_side: RICH_TEXT_IMAGE_SIDE_DEFAULT },
    // A content page's own text (adr/0073 Ek 2026-11-19 (2) K2): its outline and questions as today
    article: { outline: "auto", questions: "auto" },
  },
  // adr/0077 Ek (Vadi): the panel's words and button empty (its button the blog's); title and count stay
  posts: { grid: {}, intro_panel: { eyebrow: null, intro: null, link: null } },
  // adr/0077 Ek (Vadi): no upper line, a straight edge; the slides and the band's steps stay
  banner: { standard: {}, split: { eyebrow: null, edge: BANNER_SPLIT_EDGES[0] } },
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
  // The footer box's band on the footer's ground (adr/0070 §4 Ek): the bands' own, set by the shop
  newsletter: { split: ["joined"], image_card: ["joined"], strip: ["joined"] },
}

/**
 * Variants on the list the theme does not draw yet: shown, not offered
 * (as the theme settings' "Ortada" was, adr/0062 karar 6). A section saved
 * with one keeps it; the storefront draws the default meanwhile. None now:
 * the footer's `free_rows` (adr/0070) has its editor (PR-3).
 */
export const UNBUILT_VARIANTS: {
  readonly [T in VariantSectionType]?: ReadonlySet<SectionVariant<T>>
} = {}

export const isUnbuilt = <T extends VariantSectionType>(type: T, variant: SectionVariant<T>) =>
  (UNBUILT_VARIANTS[type] as ReadonlySet<string> | undefined)?.has(variant) ?? false

/**
 * The variants the "Biçim" offers the section where it stands: its type's
 * list, a page's newsletter box without the footer column one (adr/0049
 * Ek 2026-11-17: a page has no footer column to sit in), the footer
 * group's rich text without the picture (adr/0073 §3, adr/0070 §4), the
 * page text (`article`) on a content page only (adr/0073 Ek 2026-11-19 (2) K2).
 */
export function offeredVariants<S extends VariantSection>(
  section: S,
  inFooter: boolean,
  onContentPage = false
): readonly SectionVariant<S["type"]>[] {
  const listed: readonly SectionVariant<S["type"]>[] = SECTION_VARIANTS[section.type]
  if (section.type === "newsletter" && !inFooter) {
    return listed.filter((each) => newsletterOnPage(each as SectionVariant<"newsletter">))
  }
  if (section.type === "rich_text") {
    const variants = onContentPage
      ? listed
      : listed.filter((each) => richTextOffPages(each as SectionVariant<"rich_text">))
    return inFooter
      ? variants.filter((each) => richTextInFooter(each as SectionVariant<"rich_text">))
      : variants
  }
  return listed
}

/**
 * Whether the panel offers the section's "Biçim" where it stands: its type
 * is drawn more than one way there (the footer group's rich text is not).
 */
export const offersVariants = (
  section: AnySection,
  inFooter = false,
  onContentPage = false
): section is VariantSection =>
  hasVariants(section.type) &&
  "variant" in section &&
  offeredVariants(section, inFooter, onContentPage).length > 1

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
