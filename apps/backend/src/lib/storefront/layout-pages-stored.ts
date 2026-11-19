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

const named = (value: unknown): string | null =>
  typeof value === "string" ? value.slice(0, 64) : null

/**
 * The content pages' layouts of a stored document as today's schema reads
 * them (adr/0073, as `storedDocument` reads every group): each section
 * through today's variant lists (`storedSection`), one the pages no longer
 * take (a type taken off since, a newer build's, a broken one) skipped and
 * named in `skipped`; a page left with none, or whose id is not a content
 * page's, is left out, so the rest of the design still reads. Pages past
 * the group's limit and a page's sections past its own are left out too,
 * so a limit lowered later never stops an older live design reading.
 * None stored (a design from before pages): null, the schema's default.
 */
export function storedPages(
  stored: unknown,
  skipped: SkippedSection[]
): { page_id: string; sections: unknown[] }[] | null {
  if (!Array.isArray(stored)) {
    return null
  }
  return stored.slice(0, LAYOUT_LIMITS.pages).flatMap((page: unknown) => {
    if (!isPlainObject(page) || typeof page["page_id"] !== "string") {
      return []
    }
    const pageId = page["page_id"]
    const sections: unknown = page["sections"]
    if (!PAGE_ID.test(pageId) || !Array.isArray(sections)) {
      return []
    }
    const group = `pages.${pageId}`
    // Past the page's limit (a limit lowered since): the first ones read, the rest left out,
    // so a live design never stops reading (second security review 2026-11-19)
    const read = sections
      .slice(0, LAYOUT_LIMITS.page)
      .map(storedSection)
      .filter((section) => {
        if (contentPageSection.safeParse(section).success) {
          return true
        }
        const fields: Record<string, unknown> = isPlainObject(section) ? section : {}
        skipped.push({ group, id: named(fields["id"]), type: named(fields["type"]) })
        return false
      })
    return read.length > 0 ? [{ page_id: pageId, sections: read }] : []
  })
}
