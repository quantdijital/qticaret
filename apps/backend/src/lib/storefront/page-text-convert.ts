import { isPlainObject } from "../../modules/platform-settings/sections/define"
import { LAYOUT_LIMITS } from "./layout-fields"
import { hasPageText, pageTextSections, withTextAt } from "./page-text"
import type { PageTextSource } from "./page-text"
import {
  designFits,
  storedIds,
  storedPage,
  withPageEntry,
  withStoredPage,
} from "./page-text-stored"

/**
 * The content pages' texts moved into a stored design (adr/0073 Ek
 * 2026-11-19 (2) K3), pure: each page's entry from before its text was a
 * section (its sections carry `placement`) takes its text sections where
 * the text stood (the sections above it, the text, the ones below; past
 * twelve the last ones go and are counted); then each page with text or
 * a role and no entry gets one, in the order given (live pages first),
 * while the design has room (fifty pages, a megabyte). An entry holding
 * text, or one without `placement`, is passed over, so a second run gives
 * the same design.
 */

export interface ConversionCount {
  /** Pages whose text went into the design. */
  converted: number
  /** Pages with text or a role left without an entry (drawn from their mirror, K1). */
  left: number
  /** Sections past a page's twelve, left out. */
  dropped: number
}

type Stored = Record<string, unknown>

const isOlder = (entry: unknown): boolean =>
  isPlainObject(entry) &&
  Array.isArray(entry["sections"]) &&
  entry["sections"].some((section) => isPlainObject(section) && "placement" in section)

const entryIds = (doc: Stored): Set<string> =>
  new Set(
    (Array.isArray(doc["pages"]) ? doc["pages"] : []).flatMap((entry) =>
      isPlainObject(entry) && typeof entry["page_id"] === "string" ? [entry["page_id"]] : []
    )
  )

/** Whether a page has anything to show as sections: text, or a role. */
const hasText = (source: PageTextSource): boolean =>
  source.body.content.length > 0 || source.roles.length > 0

/** The design with the pages' texts moved in, and what moved. */
export function convertPages(
  stored: Stored,
  sources: readonly PageTextSource[]
): { document: Stored; count: ConversionCount } {
  let doc = stored
  const count: ConversionCount = { converted: 0, left: 0, dropped: 0 }
  const entries = Array.isArray(doc["pages"]) ? doc["pages"] : []
  const older = new Set(
    entries.filter(isOlder).flatMap((entry) => {
      const id = isPlainObject(entry) ? entry["page_id"] : null
      return typeof id === "string" ? [id] : []
    })
  )
  for (const source of sources) {
    if (!older.has(source.id)) {
      continue
    }
    const page = storedPage(doc, source.id)
    if (!page || hasPageText(page.sections)) {
      continue
    }
    const texts = pageTextSections(source, storedIds(doc))
    const placed = withTextAt(page.sections, texts, page.text_at ?? 0, LAYOUT_LIMITS.page)
    const next = withStoredPage(doc, source.id, placed.sections)
    if (!designFits(next)) {
      count.left += hasText(source) ? 1 : 0
      continue
    }
    doc = next
    count.dropped += placed.dropped
    count.converted += texts.length > 0 ? 1 : 0
  }
  const laidOut = entryIds(doc)
  for (const source of sources) {
    if (laidOut.has(source.id) || !hasText(source)) {
      continue
    }
    const next = withPageEntry(doc, source)
    if (next) {
      doc = next
      count.converted += 1
    } else {
      count.left += 1
    }
  }
  return { document: doc, count }
}
