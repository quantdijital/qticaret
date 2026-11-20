import type { ContactSwitch, ContentPageSectionType, PageOnlyType } from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { BodySectionBase, HomeSection } from "@/features/storefront/api/layout-sections"

/**
 * A content page's own layout in the theme editor's document (adr/0073,
 * Ek 2026-11-19 (2) K1): the pages the shop opens in the theme editor
 * (Hakkımızda, İletişim, a new one) are one ordered list of sections, the
 * page's text among them (`rich_text` as `article`, the contact page's
 * `contact`), with the live payment and shipping facts. The page's head
 * (trail, its one h1, its cover) is not a section. Keyed by the page's id,
 * so the layout follows a new address; a page whose last section goes
 * leaves the group (its text is then drawn from its mirror).
 */

/**
 * The contact page's body as a section (K2): its own text beside the form,
 * the shop's imprint below; at most once on a page.
 */
export interface ContactSection extends BodySectionBase {
  type: "contact"
  /** The content editor's document (adr/0019). */
  body: JSONContent
  /** The contact form beside the text. */
  form: ContactSwitch
  /** The shop's imprint below. */
  imprint: ContactSwitch
}

/** The ways to pay or the shipping facts, live: no fields of their own; at most once on a page. */
export interface FactsSection extends BodySectionBase {
  type: "payment_facts" | "shipping_facts"
}

/** A section of a content page: one of the home page's types the page takes, or the page's own. */
export type ContentPageSection =
  | Extract<HomeSection, { type: Exclude<ContentPageSectionType, PageOnlyType> }>
  | ContactSection
  | FactsSection

export interface PageLayout {
  /** The content page's id (`cnt_…`, `kind: page`). */
  page_id: string
  /** One to twelve sections, in the order the page draws them. */
  sections: ContentPageSection[]
}
