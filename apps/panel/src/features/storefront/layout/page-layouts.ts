import { MARQUEE_PER_PAGE, PAGE_LAYOUT_LIMITS, isPageOnlyType } from "@qticaret/types"
import type {
  BodySection,
  ContentPageSection,
  LayoutDocument,
  PageLayout,
} from "@/features/storefront/api/layout"
import type { FoundSection } from "./sections"
import { bodyOf } from "./main-sections"
import { BODY_GROUPS, marqueesOn } from "./sections"

/**
 * The content pages' own layouts in the editor (adr/0073 §1, Ek
 * 2026-11-19 (2) K1): one entry per page that has sections, keyed by the
 * page's id, its sections one ordered list with the page's text among
 * them. The first section added to a page makes its entry; the last one
 * taken away removes it (its text is then drawn from its mirror). Fifty
 * pages have an entry at most; the contact section and the facts stand
 * once on a page.
 */

/** A content page's own layout; none: its text drawn from its mirror. */
export const pageLayoutOf = (doc: LayoutDocument, pageId: string): PageLayout | undefined =>
  doc.pages.find((page) => page.page_id === pageId)

/** A content page's sections in the order the page draws them; none without a layout. */
export const pageSectionsOf = (doc: LayoutDocument, pageId: string): ContentPageSection[] =>
  pageLayoutOf(doc, pageId)?.sections ?? []

/** The page has no layout and fifty pages already have one: none can be added to it. */
export const pagesFull = (doc: LayoutDocument, pageId: string): boolean =>
  !pageLayoutOf(doc, pageId) && doc.pages.length >= PAGE_LAYOUT_LIMITS.pages

/** The page holds its twelve sections. */
export const pageSectionsFull = (doc: LayoutDocument, pageId: string): boolean =>
  pageSectionsOf(doc, pageId).length >= PAGE_LAYOUT_LIMITS.sections

/** A page's text section: its document is some of the page's text (K2). */
export const isPageText = (section: { type: string }): boolean =>
  section.type === "rich_text" || section.type === "contact"

/** The page's own types it already holds (contact, the facts): each stands once. */
export const pageOnlyTaken = (sections: readonly { type: string }[]): Set<string> =>
  new Set(sections.filter((section) => isPageOnlyType(section.type)).map((each) => each.type))

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
  const entry: PageLayout = { page_id: pageId, sections: [...sections] }
  const at = doc.pages.findIndex((page) => page.page_id === pageId)
  if (at < 0) {
    return { ...doc, pages: [...doc.pages, entry] }
  }
  return { ...doc, pages: doc.pages.map((page, index) => (index === at ? entry : page)) }
}

/**
 * A page shown with its text made into sections (K1, `synthesized`): its
 * entry made of them, so a first change lands on them; not onto a
 * fifty-first page, nor over an entry it has.
 */
export function seededPage(
  doc: LayoutDocument,
  pageId: string,
  sections: readonly ContentPageSection[]
): LayoutDocument {
  return pageLayoutOf(doc, pageId) || pagesFull(doc, pageId) || sections.length === 0
    ? doc
    : withPageSections(doc, pageId, sections.slice(0, PAGE_LAYOUT_LIMITS.sections))
}

/**
 * A section added to a content page at `at` (else last): not past the
 * page's twelve, nor onto a fifty-first page, nor a second contact
 * section or facts block.
 */
export function addToPage(
  doc: LayoutDocument,
  pageId: string,
  section: ContentPageSection,
  at?: number
): LayoutDocument {
  const sections = [...pageSectionsOf(doc, pageId)]
  if (
    pagesFull(doc, pageId) ||
    pageSectionsFull(doc, pageId) ||
    pageOnlyTaken(sections).has(section.type)
  ) {
    return doc
  }
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
