import type {
  AnnouncementBar,
  HeaderMarquee,
  AnySection,
  BodyGroup,
  BodySection,
  BodySectionType,
  CategorySection,
  FooterNewsletter,
  HomeSection,
  HomeSectionType,
  LayoutDocument,
  LayoutGroup,
  ListGroup,
  PageGroup,
  Placement,
  ProductSection,
} from "@/features/storefront/api/layout"
import {
  ANNOUNCEMENT_DEFAULTS,
  BANNER_DEFAULTS,
  CONTENT_PAGE_SECTION_TYPES,
  MARQUEE_DEFAULTS,
  PAGE_LAYOUT_LIMITS,
  SLIDER_DEFAULTS,
  STRIP_GALLERY_DEFAULTS,
  defaultVariant,
} from "@qticaret/types"
import { LAYOUT_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"

/**
 * The groups held as one list, in the order the storefront draws them (a
 * page's body between header and footer); the content pages' own layouts
 * are `pages`, page by page (adr/0073).
 */
export const LAYOUT_GROUPS: readonly ListGroup[] = [
  "header",
  "home",
  "product",
  "category",
  "footer",
]

export const isBodyGroup = (group: LayoutGroup): group is BodyGroup =>
  group === "home" || group === "product" || group === "category"

/** A page's body: a page template's or a content page's own (adr/0073); not the header or footer. */
export const isPageGroup = (group: LayoutGroup): group is PageGroup =>
  group === "pages" || isBodyGroup(group)

/** The home page's section types, in the order the chooser offers them. */
export const HOME_TYPES: readonly HomeSectionType[] = [
  "hero",
  "hero_slider",
  "banner",
  "strip_gallery",
  "categories",
  "products",
  "featured_product",
  "brands",
  "posts",
  "reviews",
  "google_rating",
  "rich_text",
  "faq",
  "trust_badges",
  "marquee",
  "price_bands",
  "newsletter",
  "help",
]

type ProductSectionType = ProductSection["type"]
type CategorySectionType = CategorySection["type"]

/** What a product page takes under its own block (adr/0049 ek 2026-11-03). */
export const PRODUCT_TYPES: readonly ProductSectionType[] = [
  "related_products",
  "rich_text",
  "banner",
  "faq",
  "trust_badges",
  "marquee",
  "help",
  "newsletter",
]

/** What a category page takes, above or below its products. */
export const CATEGORY_TYPES: readonly CategorySectionType[] = [
  "rich_text",
  "banner",
  "faq",
  "trust_badges",
  "marquee",
  "help",
  "newsletter",
]

/**
 * What a content page takes, above or below its text (adr/0073 §3): the
 * contract's list, in the home page's order (no opening, no price bands,
 * nothing of the header or the footer).
 */
export const PAGE_TYPES: readonly HomeSectionType[] = HOME_TYPES.filter((type) =>
  (CONTENT_PAGE_SECTION_TYPES as readonly string[]).includes(type)
)

/** Each page body's section types, as its chooser offers them. */
export const GROUP_TYPES: Readonly<Record<PageGroup, readonly BodySectionType[]>> = {
  home: HOME_TYPES,
  product: PRODUCT_TYPES,
  category: CATEGORY_TYPES,
  pages: PAGE_TYPES,
}

/** The sections a page body holds at most (a content page: each page's own). */
export const groupLimit = (group: PageGroup): number =>
  group === "pages" ? PAGE_LAYOUT_LIMITS.sections : LAYOUT_LIMITS[group]

const ID_LENGTH = 12
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/** A new section's id: 12 lowercase letters and digits, none the document holds already. */
export function newSectionId(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
    const id = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")
    if (!taken.has(id)) {
      return id
    }
  }
}

/** Every section of the document, group by group, the content pages' last (page by page). */
export const allSections = (doc: LayoutDocument): AnySection[] => [
  ...LAYOUT_GROUPS.flatMap((group): readonly AnySection[] => doc[group]),
  ...doc.pages.flatMap((page) => page.sections),
]

/**
 * A category page's (or a content page's) sections in one place: above
 * the grid (the text) or below it, in order (the grid in neither).
 */
export function placed<S extends AnySection>(
  sections: readonly S[],
  placement: Placement
): Extract<S, { placement: Placement }>[] {
  return sections.filter(
    (section): section is Extract<S, { placement: Placement }> =>
      "placement" in section && section.placement === placement
  )
}

export const idsOf = (doc: LayoutDocument): Set<string> =>
  new Set(
    allSections(doc).flatMap((section) =>
      // The free rows footer's rows and blocks share the sections' ids (adr/0070 §2)
      section.type === "footer_bar" && section.variant === "free_rows"
        ? [
            section.id,
            ...section.rows.flatMap((row) => [
              row.id,
              ...row.columns.flatMap((column) => column.blocks.map((block) => block.id)),
            ]),
          ]
        : [section.id]
    )
  )

/** Where a section is: its group and place there; a content page's (`pages`) names its page. */
export interface FoundSection {
  group: LayoutGroup
  section: AnySection
  /** Its place in its group's list (a content page's: in that page's sections). */
  index: number
  /** The content page it is on (`group: "pages"`); null elsewhere. */
  page: string | null
}

/** A section by its id, with the group it sits in. */
export function findSection(doc: LayoutDocument, id: string): FoundSection | null {
  for (const group of LAYOUT_GROUPS) {
    const sections: readonly AnySection[] = doc[group]
    const index = sections.findIndex((section) => section.id === id)
    const section = sections[index]
    if (section) {
      return { group, section, index, page: null }
    }
  }
  for (const page of doc.pages) {
    const index = page.sections.findIndex((section) => section.id === id)
    const section = page.sections[index]
    if (section) {
      return { group: "pages", section, index, page: page.page_id }
    }
  }
  return null
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null } as const

/** A section as the chooser adds it: the storefront's own words until the shop writes its own. */
export function newHomeSection(type: HomeSectionType, id: string): HomeSection {
  const base = { id, ...ALWAYS }
  switch (type) {
    case "faq":
      return { ...base, type, title: null, items: [{ question: "", answer: "" }] }
    case "hero":
      return {
        ...base,
        type,
        variant: defaultVariant(type),
        eyebrow: null,
        heading: null,
        text: null,
        links: [],
        image: null,
      }
    case "price_bands":
      return { ...base, type, ...newPriceBands() }
    case "hero_slider":
      return {
        ...base,
        type,
        slides: [],
        height: "regular",
        scroller: SLIDER_DEFAULTS,
      }
    case "banner":
      return { ...base, type, slides: [], ...BANNER_DEFAULTS }
    case "strip_gallery":
      // No strip yet: the shop adds two to eight, each from a record or its own picture
      return { ...base, type, title: null, text: null, items: [], ...STRIP_GALLERY_DEFAULTS }
    case "categories":
      return {
        ...base,
        type,
        title: null,
        category_ids: [],
        show_count: false,
        more: null,
        variant: defaultVariant(type),
      }
    case "products":
      return {
        ...base,
        type,
        title: null,
        variant: "grid",
        source: { kind: "newest" },
        limit: 12,
        columns: 3,
        more: { kind: "system", target: "shop", label: null },
      }
    case "featured_product":
      return { ...base, type, title: null, text: null, product_id: "" }
    case "brands":
      return { ...base, type, title: null, brand_ids: [] }
    case "posts":
      return { ...base, type, title: null, limit: 3 }
    case "reviews":
      return { ...base, type, title: null, limit: 6 }
    case "google_rating":
      return { ...base, type, title: null, excerpts: 0, profile_link: true }
    case "rich_text":
      return { ...base, type, title: null, body: { type: "doc", content: [] } }
    case "trust_badges":
      return { ...base, type, variant: defaultVariant(type) }
    case "marquee":
      return { ...base, ...newMarqueeFields() }
    case "newsletter":
      return {
        ...base,
        type,
        title: null,
        text: null,
        variant: defaultVariant(type),
        description: null,
      }
    case "help":
      return { ...base, type, title: null, text: null }
  }
}

/**
 * A section of a page body as its chooser adds it; a category page's (or
 * a content page's) goes where it was added (below the products, or the
 * page's text, unless said otherwise).
 */
export function newBodySection(
  group: PageGroup,
  type: BodySectionType,
  id: string,
  placement: Placement = "bottom"
): BodySection {
  if (type === "related_products") {
    const base = { id, ...ALWAYS }
    return {
      ...base,
      type,
      title: null,
      variant: "grid",
      source: { kind: "same_category" },
      limit: 8,
      columns: 3,
    }
  }
  const section = newHomeSection(type, id)
  return group === "category" || group === "pages"
    ? ({ ...section, placement } as CategorySection)
    : section
}

/**
 * A new price bands strip's fields: three bands to start from, each an
 * upper bound in whole lira, the last without one ("and up"), and a label
 * to write (the form suggests one from the bound, as a strip's first
 * item); the contract's default products shown small.
 */
const newPriceBands = () => ({
  title: null,
  bands: [
    { label: "", text: null, max: 500, category_id: null },
    { label: "", text: null, max: 1000, category_id: null },
    { label: "", text: null, max: null, category_id: null },
  ],
  thumbs: PRICE_BANDS_LIMITS.thumbs.default,
})

/** The announcement bar, with one line to write. */
export const newAnnouncementBar = (id: string): AnnouncementBar => ({
  id,
  ...ALWAYS,
  type: "announcement_bar",
  lines: [""],
  ...ANNOUNCEMENT_DEFAULTS,
})

/** A new scrolling strip's fields: one item to write, the contract's default steps. */
const newMarqueeFields = () => ({
  type: "marquee" as const,
  items: [{ icon: null, text: "", subtext: null, link: null }],
  ...MARQUEE_DEFAULTS,
})

/** The header group's scrolling strip, above the shop's header (adr/0049 Ek 2026-11-14 §10 karar 9). */
export const newHeaderMarquee = (id: string): HeaderMarquee => ({
  id,
  ...ALWAYS,
  ...newMarqueeFields(),
})

/**
 * Scrolling strips a page would show (adr/0049 Ek 2026-11-14 §4.1): the
 * header's and the footer group's (adr/0070 §4), on every page, with the page's own;
 * hidden ones count too.
 */
export const marqueesOn = (doc: LayoutDocument, page: BodyGroup): number =>
  [...doc.header, ...doc.footer, ...doc[page]].filter((section) => section.type === "marquee")
    .length

/** A page's price bands strips (the home page's only), hidden ones counted. */
export const priceBandsOn = (doc: LayoutDocument, page: BodyGroup): number =>
  doc[page].filter((section) => section.type === "price_bands").length

/** The pages a strip in the header would show on beside their own. */
export const BODY_GROUPS: readonly BodyGroup[] = ["home", "product", "category"]

/** The footer's newsletter box, in the storefront's own words. */
export const newFooterNewsletter = (id: string): FooterNewsletter => ({
  id,
  ...ALWAYS,
  type: "newsletter",
  title: null,
  text: null,
  variant: "standard",
  description: null,
})

/** A copy under a new id, placed right after the section. */
export function copyOf<T extends AnySection>(section: T, id: string): T {
  return { ...structuredClone(section), id }
}

/** Shown only from or until a moment. */
export const isScheduled = (section: AnySection): boolean =>
  section.starts_at !== null || section.ends_at !== null

/** A text field's value as the document keeps it: nothing written is none. */
export const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value)

/** The document as the server takes it: the same text means the same document. */
export const sameDocument = (a: LayoutDocument, b: LayoutDocument): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
