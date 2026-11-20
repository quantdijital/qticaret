import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { ContentDoc } from "../../lib/content/doc"
import { rewriteDocHrefs } from "../../lib/content/links"
import { readStoredLayout } from "../../lib/storefront/layout"
import type { ContentPageSection } from "../../lib/storefront/layout"
import { isPageText } from "../../lib/storefront/page-text"
import { designFits, storedPage, withStoredPage } from "../../lib/storefront/page-text-stored"
import { layoutRow } from "../storefront/layout-row"
import { systemWriteOf, undoSystemLayout, writeSystemLayout } from "../storefront/layout-system"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A content page's links where its text is (adr/0073 Ek 2026-11-19 (2)
 * K7, adr/0042 Ek 2026-11-05): in the theme editor's design. The report
 * reads a page's text sections in the draft (what the shop edits); the
 * rewrite changes them in the draft and in the live design (a new
 * revision by the system), the page's `body` mirror with them. A page
 * with no text sections in the draft is read from its `body`.
 */

/** Each page's text sections in the draft as one document, by page id; none read, none. */
export async function draftPageTexts(container: Container): Promise<Map<string, ContentDoc>> {
  const row = await layoutRow(container)
  let pages: { page_id: string; sections: ContentPageSection[] }[]
  try {
    pages = row ? readStoredLayout(row.draft).pages : []
  } catch {
    return new Map()
  }
  return new Map(
    pages.flatMap((page) => {
      const texts = page.sections.filter(isPageText)
      return texts.length > 0
        ? [
            [
              page.page_id,
              { type: "doc", content: texts.flatMap((section) => section.body.content) },
            ] as const,
          ]
        : []
    })
  )
}

/**
 * A stored design with the named pages' text sections' links rewritten,
 * the pages it changed added to `changedPages`; unchanged: null.
 */
function rewritten(
  stored: Record<string, unknown>,
  ids: readonly string[],
  next: ReadonlyMap<string, string>,
  changedPages: Set<string>
): Record<string, unknown> | null {
  let doc = stored
  for (const id of ids) {
    const page = storedPage(doc, id)
    if (!page) {
      continue
    }
    let changed = 0
    const sections = page.sections.map((section) => {
      if (!isPageText(section)) {
        return section
      }
      const out = rewriteDocHrefs(section.body, next)
      changed += out.changed
      return out.changed > 0 ? { ...section, body: out.doc } : section
    })
    if (changed > 0) {
      const candidate = withStoredPage(doc, id, sections)
      if (designFits(candidate)) {
        doc = candidate
        changedPages.add(id)
      }
    }
  }
  return doc === stored ? null : doc
}

/**
 * The pages' text sections' links rewritten in the draft and the live
 * design (under the design's lock): whether the design changed, and what
 * to record of it (the pages by id, the live revision made). Undone, the
 * design is as it was.
 */
export const rewriteLayoutLinksStep = createStep(
  "content-rewrite-layout-links",
  async (input: { ids: string[]; next: Record<string, string> }, { container }) => {
    const row = input.ids.length > 0 ? await layoutRow(container) : null
    const none = { changed: false, written: systemWriteOf(null), pages: [] as string[] }
    if (!row) {
      return new StepResponse(none, null)
    }
    const next = new Map(Object.entries(input.next))
    const pages = new Set<string>()
    const draft = rewritten(row.draft as Record<string, unknown>, input.ids, next, pages)
    const live = row.published
      ? rewritten(row.published as Record<string, unknown>, input.ids, next, pages)
      : null
    if (!draft && !live) {
      return new StepResponse(none, null)
    }
    const undo = await writeSystemLayout(container, row, {
      draft: draft ?? (row.draft as Record<string, unknown>),
      published: live,
    })
    return new StepResponse(
      { changed: true, written: systemWriteOf(undo), pages: [...pages] },
      undo
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await undoSystemLayout(container, undo)
    }
  }
)
