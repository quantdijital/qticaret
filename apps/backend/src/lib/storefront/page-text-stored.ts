import { isDeepStrictEqual } from "node:util"
import { isPlainObject } from "../../modules/platform-settings/sections/define"
import type { ContentDoc } from "../content"
import { LAYOUT_LIMITS } from "./layout-fields"
import { contentPageSection } from "./layout-pages"
import type { ContentPageSection } from "./layout-pages"
import { readStoredPages } from "./layout-pages-stored"
import { layoutDocument, readStoredLayout, sectionIds, storedDocument } from "./layout"
import { isPageText, pageSectionId, pageTextSections, withTextAt } from "./page-text"
import type { PageTextSource } from "./page-text"

/**
 * A page's text written into a stored design by the system (adr/0073 Ek
 * 2026-11-19 (2) K3, K4): only the page's own entry is read and written
 * again, every other entry stays as stored (an older one keeps its
 * `placement` for its own conversion), and the design is held to the
 * editor's schema (fifty pages, a megabyte) before it is written. Pure.
 */

type Stored = Record<string, unknown>

/** A stored design's page entries as stored. */
const entriesOf = (doc: Stored): unknown[] => (Array.isArray(doc["pages"]) ? doc["pages"] : [])

const idOf = (entry: unknown): string | null =>
  isPlainObject(entry) && typeof entry["page_id"] === "string" ? entry["page_id"] : null

/** One page's entry as today's schema reads it, and where an older one's text stands; none: null. */
export function storedPage(
  doc: Stored,
  pageId: string
): { sections: ContentPageSection[]; text_at: number | null } | null {
  const entry = entriesOf(doc).find((each) => idOf(each) === pageId)
  if (entry === undefined) {
    return null
  }
  const read = readStoredPages([entry], [])
  const [page] = read.pages ?? []
  if (!page) {
    return null
  }
  return {
    sections: page.sections.map((section) => contentPageSection.parse(section)),
    text_at: read.text_at[pageId] ?? null,
  }
}

/** The design with one page's entry written (in its place, else last), every other as stored. */
export function withStoredPage(
  doc: Stored,
  pageId: string,
  sections: ContentPageSection[]
): Stored {
  const entries = entriesOf(doc)
  const entry = { page_id: pageId, sections }
  const at = entries.findIndex((each) => idOf(each) === pageId)
  return {
    ...doc,
    pages:
      at < 0 ? [...entries, entry] : entries.map((each, index) => (index === at ? entry : each)),
  }
}

/** Whether the design still reads under the editor's schema (fifty pages, a megabyte, ids unique). */
export const designFits = (doc: Stored): boolean =>
  layoutDocument.safeParse(storedDocument(doc)).success

/** Every id the stored design's sections hold, as read; one that does not read holds none. */
export function storedIds(doc: Stored): Set<string> {
  try {
    return sectionIds(readStoredLayout(doc))
  } catch {
    return new Set()
  }
}

/**
 * A page's entry made from its text where it has none, as the conversion
 * makes one (K3): its text sections; none for a page with no text and no
 * role, nor past the fifty pages or the megabyte (the page is then drawn
 * from its mirror, K1). The design with it, or null.
 */
export function withPageEntry(doc: Stored, source: PageTextSource): Stored | null {
  if (entriesOf(doc).length >= LAYOUT_LIMITS.pages) {
    return null
  }
  const texts = pageTextSections(source, storedIds(doc))
  if (texts.length === 0) {
    return null
  }
  const next = withStoredPage(doc, source.id, texts)
  return designFits(next) ? next : null
}

/**
 * The page's text replaced in a stored design (K4): in its first page
 * text (`article`), else its contact section, else a new `article` at its
 * head (or where an older entry's text stood); no entry, one made where
 * there is room (`withPageEntry`). The design, or null when nothing
 * changed or it would not fit.
 */
export function withPageText(doc: Stored, source: PageTextSource): Stored | null {
  const page = storedPage(doc, source.id)
  if (!page) {
    return withPageEntry(doc, source)
  }
  const sections = replacedText(page.sections, source.body)
  const placed = sections ?? placedText(page, source, storedIds(doc))
  // The same text again (an import run twice) writes nothing: no revision, none pruned
  if (page.text_at === null && isDeepStrictEqual(placed, page.sections)) {
    return null
  }
  const next = withStoredPage(doc, source.id, placed)
  return designFits(next) ? next : null
}

/** The sections with the first article's (else the contact section's) text replaced; none: null. */
function replacedText(
  sections: readonly ContentPageSection[],
  body: ContentDoc
): ContentPageSection[] | null {
  const article = sections.findIndex(
    (each) => each.type === "rich_text" && each.variant === "article"
  )
  const at = article >= 0 ? article : sections.findIndex((each) => each.type === "contact")
  if (at < 0) {
    return null
  }
  return sections.map((each, index) =>
    index === at && isPageText(each) ? { ...each, body } : each
  )
}

/** A new `article` with the text, where an older entry's text stood, else first. */
function placedText(
  page: { sections: ContentPageSection[]; text_at: number | null },
  source: PageTextSource,
  taken: Set<string>
): ContentPageSection[] {
  const article = contentPageSection.parse({
    id: pageSectionId(source.id, "article", taken),
    type: "rich_text",
    variant: "article",
    body: source.body,
  })
  return withTextAt(page.sections, [article], page.text_at ?? 0, LAYOUT_LIMITS.page).sections
}
