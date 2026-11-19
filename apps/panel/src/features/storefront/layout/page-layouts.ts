import { MARQUEE_PER_PAGE, PAGE_LAYOUT_LIMITS } from "@qticaret/types"
import type {
  BodySection,
  ContentPageSection,
  LayoutDocument,
  PageLayout,
  Placement,
} from "@/features/storefront/api/layout"
import type { FoundSection } from "./sections"
import { bodyOf } from "./main-sections"
import { BODY_GROUPS, marqueesOn, placed } from "./sections"

/**
 * The content pages' own layouts in the editor (adr/0073 §1): one entry
 * per page that has sections, keyed by the page's id. The first section
 * added to a page makes its entry; the last one taken away removes it (a
 * page has no empty layout and frees its place among the twenty). A
 * page's sections stand above its text first, then below it, as a
 * category page's stand around its products.
 */

/** A content page's own layout; none: the page is drawn as before. */
export const pageLayoutOf = (doc: LayoutDocument, pageId: string): PageLayout | undefined =>
  doc.pages.find((page) => page.page_id === pageId)

/** A content page's sections, above its text first; none without a layout. */
export const pageSectionsOf = (doc: LayoutDocument, pageId: string): ContentPageSection[] =>
  pageLayoutOf(doc, pageId)?.sections ?? []

/** The page has no layout and twenty pages already have one: none can be added to it. */
export const pagesFull = (doc: LayoutDocument, pageId: string): boolean =>
  !pageLayoutOf(doc, pageId) && doc.pages.length >= PAGE_LAYOUT_LIMITS.pages

/** The page holds its twelve sections. */
export const pageSectionsFull = (doc: LayoutDocument, pageId: string): boolean =>
  pageSectionsOf(doc, pageId).length >= PAGE_LAYOUT_LIMITS.sections

/** Scrolling strips the page would show: the header's and the footer group's with its own. */
export const marqueesOnPage = (doc: LayoutDocument, pageId: string): number =>
  [...doc.header, ...doc.footer, ...pageSectionsOf(doc, pageId)].filter(
    (section) => section.type === "marquee"
  ).length

/** A content page's strips are full (adr/0049 Ek 2026-11-14 §4.1). */
export const pageMarqueesFull = (doc: LayoutDocument, pageId: string): boolean =>
  marqueesOnPage(doc, pageId) >= MARQUEE_PER_PAGE

/**
 * Some page (a template or a content page) already shows its two strips:
 * the header and the footer group, which show on every page, add none.
 */
export const anyPageMarqueesFull = (doc: LayoutDocument): boolean =>
  BODY_GROUPS.some((page) => marqueesOn(doc, page) >= MARQUEE_PER_PAGE) ||
  doc.pages.some((page) => pageMarqueesFull(doc, page.page_id))

/** Above the text first, then below it: the order the page draws and the server keeps. */
const inOrder = (sections: readonly ContentPageSection[]): ContentPageSection[] => [
  ...placed(sections, "top"),
  ...placed(sections, "bottom"),
]

/**
 * The document with a page's sections replaced: none removes the page's
 * entry; a page without one gets it at the end of the group.
 */
export function withPageSections(
  doc: LayoutDocument,
  pageId: string,
  sections: readonly ContentPageSection[]
): LayoutDocument {
  const others = doc.pages.filter((page) => page.page_id !== pageId)
  if (sections.length === 0) {
    return others.length === doc.pages.length ? doc : { ...doc, pages: others }
  }
  const entry: PageLayout = { page_id: pageId, sections: inOrder(sections) }
  const at = doc.pages.findIndex((page) => page.page_id === pageId)
  if (at < 0) {
    return { ...doc, pages: [...doc.pages, entry] }
  }
  return { ...doc, pages: doc.pages.map((page, index) => (index === at ? entry : page)) }
}

/**
 * A section added to a content page at `at` (else at the end of its side):
 * not past the page's twelve, nor onto a twenty-first page.
 */
export function addToPage(
  doc: LayoutDocument,
  pageId: string,
  section: ContentPageSection,
  at?: number
): LayoutDocument {
  if (pagesFull(doc, pageId) || pageSectionsFull(doc, pageId)) {
    return doc
  }
  const sections = [...pageSectionsOf(doc, pageId)]
  const place = at === undefined ? sections.length : Math.max(0, Math.min(at, sections.length))
  sections.splice(place, 0, section)
  return withPageSections(doc, pageId, sections)
}

/** A page's sections changed by `change` (the section's own page, wherever it is). */
export function inPageOf(
  doc: LayoutDocument,
  found: FoundSection,
  change: (sections: ContentPageSection[], index: number) => ContentPageSection[]
): LayoutDocument {
  if (found.page === null) {
    return doc
  }
  return withPageSections(
    doc,
    found.page,
    change([...pageSectionsOf(doc, found.page)], found.index)
  )
}

/** The list a section moves in: its page's on its side of the text. */
export function sideOf(doc: LayoutDocument, found: FoundSection): ContentPageSection[] {
  const section = found.section as ContentPageSection
  return found.page === null ? [] : placed(pageSectionsOf(doc, found.page), section.placement)
}

/** A content page's section moved to the other side of the page's text, last there. */
export function placeOnPage(
  doc: LayoutDocument,
  found: FoundSection,
  placement: Placement
): LayoutDocument {
  const section = found.section as ContentPageSection
  if (found.page === null || section.placement === placement) {
    return doc
  }
  const others = pageSectionsOf(doc, found.page).filter((each) => each.id !== section.id)
  return withPageSections(doc, found.page, [...others, { ...section, placement }])
}

/** The sections beside a found one in its page body (a rail's tab mates, the limit counted). */
export function bodyAround(doc: LayoutDocument, found: FoundSection): BodySection[] {
  if (found.group === "pages") {
    return found.page === null ? [] : pageSectionsOf(doc, found.page)
  }
  return found.group === "home" || found.group === "product" || found.group === "category"
    ? bodyOf(doc, found.group)
    : []
}

/** The pages whose layouts the server left out (deleted since): `answer`'s lack them. */
export const droppedPages = (sent: LayoutDocument, answer: LayoutDocument): string[] => {
  const kept = new Set(answer.pages.map((page) => page.page_id))
  return sent.pages.map((page) => page.page_id).filter((id) => !kept.has(id))
}

/** The document without these pages' layouts. */
export const withoutPages = (doc: LayoutDocument, ids: readonly string[]): LayoutDocument =>
  doc.pages.some((page) => ids.includes(page.page_id))
    ? { ...doc, pages: doc.pages.filter((page) => !ids.includes(page.page_id)) }
    : doc
