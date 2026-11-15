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
  Placement,
  ProductSection,
} from "@/features/storefront/api/layout"
import { BANNER_DEFAULTS, MARQUEE_DEFAULTS, defaultVariant } from "@qticaret/types"
import { LAYOUT_LIMITS, PRICE_BANDS_LIMITS, SLIDER_LIMITS } from "@/features/storefront/api/layout"

/** The groups in the order the storefront draws them (a page's body between header and footer). */
export const LAYOUT_GROUPS: readonly LayoutGroup[] = [
  "header",
  "home",
  "product",
  "category",
  "footer",
]

export const isBodyGroup = (group: LayoutGroup): group is BodyGroup =>
  group === "home" || group === "product" || group === "category"

/** The home page's section types, in the order the chooser offers them. */
export const HOME_TYPES: readonly HomeSectionType[] = [
  "hero",
  "hero_slider",
  "banner",
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

/** Each body group's section types, as its chooser offers them. */
export const GROUP_TYPES: Readonly<Record<BodyGroup, readonly BodySectionType[]>> = {
  home: HOME_TYPES,
  product: PRODUCT_TYPES,
  category: CATEGORY_TYPES,
}

/** The sections a group holds at most. */
export const groupLimit = (group: BodyGroup): number => LAYOUT_LIMITS[group]

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

/** Every section of the document, group by group. */
export const allSections = (doc: LayoutDocument): AnySection[] =>
  LAYOUT_GROUPS.flatMap((group): readonly AnySection[] => doc[group])

/** A category page's sections in one place: above the grid or below it, in order (the grid in neither). */
export const placed = (
  sections: readonly LayoutDocument["category"][number][],
  placement: Placement
): CategorySection[] =>
  sections.filter(
    (section): section is CategorySection =>
      "placement" in section && section.placement === placement
  )

export const idsOf = (doc: LayoutDocument): Set<string> =>
  new Set(allSections(doc).map((section) => section.id))

/** A section by its id, with the group it sits in. */
export function findSection(
  doc: LayoutDocument,
  id: string
): { group: LayoutGroup; section: AnySection; index: number } | null {
  for (const group of LAYOUT_GROUPS) {
    const sections: readonly AnySection[] = doc[group]
    const index = sections.findIndex((section) => section.id === id)
    const section = sections[index]
    if (section) {
      return { group, section, index }
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
        autoplay: false,
        interval: SLIDER_LIMITS.interval.default,
        dots: true,
        arrows: true,
      }
    case "banner":
      return { ...base, type, slides: [], ...BANNER_DEFAULTS }
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
    case "help":
      return { ...base, type, title: null, text: null }
  }
}

/**
 * A section of a body group as its chooser adds it; a category page's
 * goes where it was added (below the products unless said otherwise).
 */
export function newBodySection(
  group: BodyGroup,
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
      source: { kind: "same_category" },
      limit: 8,
      columns: 3,
    }
  }
  const section = newHomeSection(type, id)
  return group === "category" ? ({ ...section, placement } as CategorySection) : section
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
    { label: "", text: null, max: 500 },
    { label: "", text: null, max: 1000 },
    { label: "", text: null, max: null },
  ],
  thumbs: PRICE_BANDS_LIMITS.thumbs.default,
})

/** The announcement bar, with one line to write. */
export const newAnnouncementBar = (id: string): AnnouncementBar => ({
  id,
  ...ALWAYS,
  type: "announcement_bar",
  lines: [""],
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
 * header's, on every page, with the page's own; hidden ones count too.
 */
export const marqueesOn = (doc: LayoutDocument, page: BodyGroup): number =>
  [...doc.header, ...doc[page]].filter((section) => section.type === "marquee").length

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
