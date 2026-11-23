/**
 * A content page's own sections (adr/0073, Ek 2026-11-19 (2)): every
 * content page (Hakkımızda, İletişim, a page the shop opens) is laid out
 * in the theme editor as one ordered list of sections, its own text among
 * them (`rich_text` as `article`, the contact page's `contact`). The
 * page's head (trail, its one h1, its cover) is not a section and stands
 * above the list. A page the design has no entry for is answered with its
 * text made into sections (`synthesized`).
 *
 * The types a page takes are the home page's but the opening (`hero`,
 * `hero_slider`: the page's head owns the h1 and the first picture) and
 * the price bands, nothing of the header or the footer, and the page's own
 * text sections. The contract's list: a new type goes here first, then
 * into the backend's mirror (`lib/storefront/layout-pages.ts`, a test
 * keeps them equal).
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-pages` subpath).
 */
import type { StoreLayoutSection } from "./layout.js"
import type { StoreTextHeading, StoreTextImage } from "./section-rich-text.js"
import type { SectionDevice } from "./section-device.js"
import type { SectionLook } from "./section-look.js"

export const CONTENT_PAGE_SECTION_TYPES = [
  "rich_text",
  "banner",
  "strip_gallery",
  "faq",
  "trust_badges",
  "help",
  "newsletter",
  "marquee",
  "products",
  "featured_product",
  "categories",
  "brands",
  "posts",
  "reviews",
  "google_rating",
  "stats",
  "steps",
  "search_box",
  "photo_collage",
  "contact",
  "payment_facts",
  "shipping_facts",
] as const

export type ContentPageSectionType = (typeof CONTENT_PAGE_SECTION_TYPES)[number]

/**
 * The page's own sections no other group takes, each at most once on a
 * page: the contact form and details (their anchors are the page's), the
 * live payment and shipping facts.
 */
export const PAGE_ONLY_TYPES = ["contact", "payment_facts", "shipping_facts"] as const

export type PageOnlyType = (typeof PAGE_ONLY_TYPES)[number]

/** Whether the type is one of a page's own (at most once on it). */
export const isPageOnlyType = (type: string): type is PageOnlyType =>
  (PAGE_ONLY_TYPES as readonly string[]).includes(type)

/**
 * Pages with an entry in the design (every page with text has one since
 * Ek 2026-11-19 (2)), and sections on one page, its text sections among them.
 */
export const PAGE_LAYOUT_LIMITS = { pages: 50, sections: 12 } as const

/** The contact section's switches: the form and the shop's imprint, both on by default. */
export const CONTACT_SWITCHES = ["on", "off"] as const

export type ContactSwitch = (typeof CONTACT_SWITCHES)[number]

/** A switch as a reader takes it: absent or off the list, `on`. */
export const contactSwitchOf = (value: unknown): ContactSwitch => (value === "off" ? "off" : "on")

interface PageSectionParts {
  id: string
  look?: SectionLook
  device?: SectionDevice
}

/**
 * The contact page's body as a section (K2): its own text and the "Bize
 * ulaşın" stage beside the form, the shop's imprint below. The form, the
 * ways to reach the shop and the imprint are the storefront's to fill.
 */
export interface StoreContactSection extends PageSectionParts {
  type: "contact"
  html: string
  images: StoreTextImage[]
  headings: StoreTextHeading[]
  form: ContactSwitch
  imprint: ContactSwitch
}

/** The ways to pay or the shipping facts, live (no fields: the storefront reads them). */
export interface StoreFactsSection extends PageSectionParts {
  type: "payment_facts" | "shipping_facts"
}

/** A section of a content page as `GET /store/storefront-layout/pages/:id` gives it. */
export type StoreContentPageSection =
  | Extract<StoreLayoutSection, { type: Exclude<ContentPageSectionType, PageOnlyType> }>
  | StoreContactSection
  | StoreFactsSection

/**
 * A content page's own layout, its sections showing now, in the shop's
 * order (adr/0073 §6, Ek 2026-11-19 (2) K1).
 */
export interface StorePageLayout {
  /** The content page's id (`cnt_…`). */
  page_id: string
  sections: StoreContentPageSection[]
  /**
   * The design has no entry for the page (its limit was full, an import,
   * an older revision): its text made into sections as the conversion
   * would (`article`, and the role's own section); absent otherwise.
   */
  synthesized?: true
}
