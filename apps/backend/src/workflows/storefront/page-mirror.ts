import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { docStats, summaryOf } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { hasPageText, pageMirror } from "../../lib/storefront/page-text"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { SUMMARY_LENGTH, canonical } from "../content/rules"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A content page's `body` as the mirror of its published text sections
 * (adr/0073 Ek 2026-11-19 (2) K2): what the meta description, JSON-LD,
 * the sitemap's `lastmod`, the SEO advisor and the AI facts read, and the
 * text a page without an entry in the design is drawn from (K1). Written
 * by the system only (a publication, an import, a link rewrite), and only
 * for a page whose mirror changed: its text, summary and word count, and
 * on a page that has been live its `revised_at` (a change of the page's
 * own text; a section around it is not one).
 */

/** The fields a mirror writes, as they were or will be. */
export interface MirrorFields {
  id: string
  body: Record<string, unknown>
  body_summary: string
  word_count: number
  revised_at: Date | null
}

/**
 * The mirrors a live design gives (pure): each page whose entry holds
 * text sections, and each page whose entry held some in the design live
 * before (`before`) and holds none now (its text taken off: an empty
 * mirror). A page with no entry keeps its text, drawn from it (K1, K6);
 * an entry that never held text (a page laid out before its text was a
 * section) leaves the text alone.
 */
export function mirrorsOf(
  pages: LayoutDocument["pages"],
  before: ReadonlySet<string>
): Map<string, ContentDoc> {
  return new Map(
    pages
      .filter((page) => hasPageText(page.sections) || before.has(page.page_id))
      .map((page) => [page.page_id, pageMirror(page.sections)])
  )
}

/** The pages of a design whose entries hold text sections. */
export const textPages = (doc: LayoutDocument | null): string[] =>
  (doc?.pages ?? []).filter((page) => hasPageText(page.sections)).map((page) => page.page_id)

/**
 * Writes each page's mirror where it differs from its `body` (posts and
 * ids no page has are passed over): the pages written, and their fields
 * as they were, for an undo.
 */
export async function writeMirrors(
  container: Container,
  mirrors: ReadonlyMap<string, ContentDoc>,
  now = new Date()
): Promise<{ written: string[]; previous: MirrorFields[] }> {
  const ids = [...mirrors.keys()]
  if (ids.length === 0) {
    return { written: [], previous: [] }
  }
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const entries = await service.listContentEntries(
    { id: ids, kind: "page" },
    {
      select: ["id", "body", "body_summary", "word_count", "published_at", "revised_at"],
      take: null,
    }
  )
  const previous: MirrorFields[] = []
  for (const entry of entries) {
    const mirror = mirrors.get(entry.id)
    if (!mirror || canonical(mirror) === canonical(entry.body)) {
      continue
    }
    const stats = docStats(mirror)
    previous.push({
      id: entry.id,
      body: entry.body,
      body_summary: entry.body_summary,
      word_count: entry.word_count,
      revised_at: entry.revised_at,
    })
    try {
      await service.updateContentEntries({
        id: entry.id,
        body: mirror as unknown as Record<string, unknown>,
        body_summary: summaryOf(stats.text, SUMMARY_LENGTH),
        word_count: stats.words,
        revised_at: entry.published_at ? now : entry.revised_at,
      })
    } catch (error) {
      await restoreMirrors(container, previous)
      throw error
    }
  }
  return { written: previous.map((each) => each.id), previous }
}

/** The pages' mirror fields back as they were. */
export async function restoreMirrors(
  container: Container,
  previous: readonly MirrorFields[]
): Promise<void> {
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  for (const fields of previous) {
    await service.updateContentEntries(fields)
  }
}

/**
 * The mirrors written as a step (under the content lock): the pages
 * written, `{ id, kind }` each, for `content.saved`. Undone, as they were.
 */
export const writeMirrorsStep = createStep(
  "storefront-page-mirrors",
  async (mirrors: { id: string; doc: ContentDoc }[], { container }) => {
    const { written, previous } = await writeMirrors(
      container,
      new Map(mirrors.map((each) => [each.id, each.doc]))
    )
    return new StepResponse(
      written.map((id) => ({ id, kind: "page" as const })),
      previous
    )
  },
  async (previous, { container }) => {
    if (previous) {
      await restoreMirrors(container, previous)
    }
  }
)
