import type {
  AnySection,
  FooterBodySection,
  FooterSection,
  LayoutDocument,
} from "@/features/storefront/api/layout"
import { newFooterNewsletter, newHomeSection } from "./sections"
import { anyPageMarqueesFull } from "./page-layouts"

/**
 * The footer group (adr/0070 §4, Shopify's footer group): the shop's
 * footer (`footer_bar`, fixed at the bottom, no place in the order) and
 * above it, in the shop's order, the sections it may add, each at most once.
 */

/** What the footer group's "Bölüm ekle" offers, in the chooser's order. */
export const FOOTER_TYPES = ["newsletter", "rich_text", "trust_badges", "marquee"] as const
export type FooterAddType = (typeof FOOTER_TYPES)[number]

/** The sections the footer group holds at most: the bar and the four above it (the server's). */
export const FOOTER_LIMIT = 5

const BODY_TYPES: readonly string[] = ["rich_text", "trust_badges", "marquee"]

/** A footer group section drawn as a page's: a rich text, trust badges, a strip. */
export const isFooterBody = (section: AnySection): section is FooterBodySection =>
  BODY_TYPES.includes(section.type)

/** The footer group's sections above the bar, in their order. */
export const footerAbove = (doc: LayoutDocument): FooterSection[] =>
  doc.footer.filter((section) => section.type !== "footer_bar")

/** The types the group does not hold yet: each at most once. */
export const footerTypesLeft = (doc: LayoutDocument): FooterAddType[] =>
  FOOTER_TYPES.filter((type) => !doc.footer.some((section) => section.type === type))

/**
 * A strip in the footer shows on every page, as the header's does
 * (adr/0049 Ek 2026-11-14 §4.1): not while a page already has its two.
 */
export const footerMarqueeFull = (doc: LayoutDocument): boolean => anyPageMarqueesFull(doc)

/** A new footer group section: the storefront's own words until the shop writes its own. */
export function newFooterSection(type: FooterAddType, id: string): FooterSection {
  return type === "newsletter"
    ? newFooterNewsletter(id)
    : (newHomeSection(type, id) as FooterBodySection)
}
