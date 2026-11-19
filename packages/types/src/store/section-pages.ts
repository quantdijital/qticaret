/**
 * A content page's own sections (adr/0073): the pages the shop writes in
 * İçerik (Hakkımızda, İletişim, a new one) take sections from the theme
 * editor, above the page's own text (`top`) or below it (`bottom`). The
 * page's head (trail, its one h1, its cover) and its text, with the
 * contact, payment and shipping pages' own parts, stay where they are and
 * are not sections. A page with no layout of its own is drawn as before.
 *
 * The types a page takes are the home page's but the opening (`hero`,
 * `hero_slider`: the page's head owns the h1 and the first picture) and
 * the price bands; nothing of the header or the footer. The contract's
 * list: a new type goes here first, then into the backend's mirror
 * (`lib/storefront/layout-pages.ts`, a test keeps them equal).
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-pages` subpath).
 */
import type { StoreLayoutSection } from "./layout.js"

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
] as const

export type ContentPageSectionType = (typeof CONTENT_PAGE_SECTION_TYPES)[number]

/** Pages with a layout of their own, and sections on one page (above and below its text). */
export const PAGE_LAYOUT_LIMITS = { pages: 20, sections: 12 } as const

/** Where a page's section stands: above the page's text or below it (the default). */
export type ContentPagePlacement = "top" | "bottom"

/** A section of a content page as `GET /store/storefront-layout/pages/:id` gives it. */
export type StoreContentPageSection = Extract<
  StoreLayoutSection,
  { type: ContentPageSectionType }
> & { placement: ContentPagePlacement }

/**
 * A content page's own layout, its sections showing now, in the shop's
 * order (adr/0073 §6); a page with none answers `null`.
 */
export interface StorePageLayout {
  /** The content page's id (`cnt_…`). */
  page_id: string
  sections: StoreContentPageSection[]
}
