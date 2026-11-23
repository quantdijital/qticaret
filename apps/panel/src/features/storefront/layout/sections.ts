import type {
  AnySection,
  BodyGroup,
  BodySectionType,
  CategorySection,
  HomeSectionType,
  LayoutDocument,
  LayoutGroup,
  ListGroup,
  PageGroup,
  Placement,
  ProductSection,
} from "@/features/storefront/api/layout"
import {
  CAPABILITY_GROUPS,
  CONTENT_PAGE_SECTION_TYPES,
  PAGE_LAYOUT_LIMITS,
  PAGE_ONLY_TYPES,
  SECTION_REQUIRES,
  capabilityOf,
  sectionAllowed,
} from "@qticaret/types"
import type { Capability } from "@qticaret/types"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"

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
  "stats",
  "steps",
  "photo_collage",
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
 * What a content page takes (adr/0073 §3, Ek 2026-11-19 (2) K5): the
 * contract's list, the home page's types in their order (no opening, no
 * price bands, nothing of the header or the footer), then the page's own
 * (contact, the payment and shipping facts, each once on a page). The
 * page's text (`rich_text` as `article`) is offered first by the chooser.
 */
export const PAGE_TYPES: readonly BodySectionType[] = [
  ...HOME_TYPES.filter((type) => (CONTENT_PAGE_SECTION_TYPES as readonly string[]).includes(type)),
  ...PAGE_ONLY_TYPES,
]

/** Each page body's section types, as its chooser offers them. */
export const GROUP_TYPES: Readonly<Record<PageGroup, readonly BodySectionType[]>> = {
  home: HOME_TYPES,
  product: PRODUCT_TYPES,
  category: CATEGORY_TYPES,
  pages: PAGE_TYPES,
}

/**
 * The shop's feature flags as the editor reads them for flagged sections
 * (adr/0077 §8): the flags on, and which section type needs which
 * (`SECTION_REQUIRES`; a test passes its own).
 */
export interface SectionFlags {
  on: ReadonlySet<string>
  requires: Readonly<Record<string, string>>
}

export const NO_FLAGS: SectionFlags = { on: new Set(), requires: SECTION_REQUIRES }

/** The capability a section type needs that is off in this shop, else null (it shows). */
export const offCapability = (type: string, flags: SectionFlags): Capability | null =>
  sectionAllowed(type, (flag) => flags.on.has(flag), flags.requires)
    ? null
    : capabilityOf(type, flags.requires)

/** The types offered: those whose flag is off are not (adr/0077 §8). */
export const allowedTypes = <T extends string>(types: readonly T[], flags: SectionFlags): T[] =>
  types.filter((type) => offCapability(type, flags) === null)

/** A page body's types as its chooser offers them, those whose flag is off left out. */
export const typesFor = (group: PageGroup, flags: SectionFlags): BodySectionType[] =>
  allowedTypes(GROUP_TYPES[group], flags)

/**
 * The chooser's groups: the sections every shop may add first, then each
 * capability's under its name ("Tarihli ürünler"), in the given order.
 */
export function chooserGroups<T extends string>(
  types: readonly T[],
  flags: SectionFlags
): { capability: Capability | null; types: T[] }[] {
  const general = types.filter((type) => capabilityOf(type, flags.requires) === null)
  const gated = (Object.keys(CAPABILITY_GROUPS) as Capability[]).map((capability) => ({
    capability,
    types: types.filter((type) => capabilityOf(type, flags.requires) === capability),
  }))
  return [{ capability: null, types: general }, ...gated].filter((group) => group.types.length > 0)
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

/** A category page's sections in one place: above the grid or below it, in order (the grid in neither). */
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

export {
  newAnnouncementBar,
  newBodySection,
  newFooterNewsletter,
  newHeaderMarquee,
  newHomeSection,
  newPageText,
} from "./new-sections"

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
