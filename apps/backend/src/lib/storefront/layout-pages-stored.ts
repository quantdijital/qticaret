import { isPlainObject } from "../../modules/platform-settings/sections/define"
import { LAYOUT_LIMITS } from "./layout-fields"
import { PAGE_ID, contentPageSection } from "./layout-pages"
import { storedSection } from "./sections/stored"

/** A section the reading left out, for the log: its group, id and type (never its content). */
export interface SkippedSection {
  group: string
  id: string | null
  type: string | null
}

/** One content page's layout as read: its id and sections, unchecked beyond each section. */
export interface StoredPage {
  page_id: string
  sections: unknown[]
}

/** The content pages' layouts of a stored document, and where an older one's text stands. */
export interface StoredPagesRead {
  /** None stored (a design from before pages): null, the schema's default. */
  pages: StoredPage[] | null
  /**
   * The pages stored before their text was a section (their sections carry
   * `placement`, adr/0073 Ek 2026-11-19 (2) K1), by page id: where the
   * page's text stands among the sections read, the count of those that
   * stood above it. The text itself is the conversion's or a restore's to
   * put there (K3, K6).
   */
  text_at: Record<string, number>
}

const named = (value: unknown): string | null =>
  typeof value === "string" ? value.slice(0, 64) : null

const placed = (section: unknown): string | null =>
  isPlainObject(section) && "placement" in section
    ? section["placement"] === "top"
      ? "top"
      : "bottom"
    : null

/** A section without its old place: today's list has none. */
const unplaced = (section: unknown): unknown => {
  if (!isPlainObject(section) || !("placement" in section)) {
    return section
  }
  return Object.fromEntries(Object.entries(section).filter(([key]) => key !== "placement"))
}

/**
 * A page's stored sections in the order they are drawn: as stored, or,
 * for a page from before its text was a section, the ones above the text
 * first, then the others (each side in its stored order), and how many
 * stood above it.
 */
export function inDrawnOrder(sections: readonly unknown[]): {
  sections: unknown[]
  above: number | null
} {
  if (!sections.some((section) => placed(section) !== null)) {
    return { sections: [...sections], above: null }
  }
  const top = sections.filter((section) => placed(section) === "top")
  const rest = sections.filter((section) => placed(section) !== "top")
  return { sections: [...top, ...rest], above: top.length }
}

/**
 * The content pages' layouts of a stored document as today's schema reads
 * them (adr/0073, as `storedDocument` reads every group): each section
 * through today's variant lists (`storedSection`), one the pages no longer
 * take (a type taken off since, a newer build's, a broken one) skipped and
 * named in `skipped`; a page left with none, or whose id is not a content
 * page's, is left out, so the rest of the design still reads. Pages past
 * the group's limit and a page's sections past its own are left out too,
 * so a limit lowered later never stops an older live design reading. A
 * page from before its text was a section (Ek 2026-11-19 (2) K1) reads
 * as one list, the sections above its text first, its place in `text_at`.
 */
export function readStoredPages(stored: unknown, skipped: SkippedSection[]): StoredPagesRead {
  const text_at: Record<string, number> = {}
  if (!Array.isArray(stored)) {
    return { pages: null, text_at }
  }
  const pages = stored.slice(0, LAYOUT_LIMITS.pages).flatMap((page: unknown) => {
    if (!isPlainObject(page) || typeof page["page_id"] !== "string") {
      return []
    }
    const pageId = page["page_id"]
    const listed: unknown = page["sections"]
    if (!PAGE_ID.test(pageId) || !Array.isArray(listed)) {
      return []
    }
    const group = `pages.${pageId}`
    const drawn = inDrawnOrder(listed)
    let above = 0
    // Past the page's limit (a limit lowered since): the first ones read, the rest left out,
    // so a live design never stops reading (second security review 2026-11-19)
    const read = drawn.sections.slice(0, LAYOUT_LIMITS.page).flatMap((raw, index) => {
      const section = unplaced(storedSection(raw))
      if (contentPageSection.safeParse(section).success) {
        if (drawn.above !== null && index < drawn.above) {
          above += 1
        }
        return [section]
      }
      const fields: Record<string, unknown> = isPlainObject(section) ? section : {}
      skipped.push({ group, id: named(fields["id"]), type: named(fields["type"]) })
      return []
    })
    if (read.length === 0) {
      return []
    }
    if (drawn.above !== null) {
      text_at[pageId] = above
    }
    return [{ page_id: pageId, sections: read }]
  })
  return { pages, text_at }
}

/** The pages' layouts alone (`readStoredPages`). */
export const storedPages = (stored: unknown, skipped: SkippedSection[]): StoredPage[] | null =>
  readStoredPages(stored, skipped).pages

/**
 * Where each older page's text stands in a stored document (`text_at`):
 * empty for a document whose pages hold their text as sections, or none.
 */
export function legacyTextAt(stored: unknown): Record<string, number> {
  if (!isPlainObject(stored)) {
    return {}
  }
  return readStoredPages(stored["pages"], []).text_at
}

/**
 * Pages written before their text was a section (a preset's `layout.json`
 * until it is rewritten, adr/0073 Ek 2026-11-19 (2) K9) as one list:
 * the sections above the text first, `placement` gone, as a stored
 * design reads (`readStoredPages`). Anything else as it is, for the
 * schema to judge.
 */
export const unplacedPages = (pages: readonly unknown[]): unknown[] =>
  pages.map((page) =>
    isPlainObject(page) && Array.isArray(page["sections"])
      ? { ...page, sections: inDrawnOrder(page["sections"]).sections.map(unplaced) }
      : page
  )
