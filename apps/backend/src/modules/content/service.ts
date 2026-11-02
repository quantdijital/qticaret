import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { ContentEntry } from "./models/content-entry"
import { ContentEntryTerm, ContentTerm } from "./models/content-term"
import { LandingPage } from "./models/landing-page"

export type ContentEntryRecord = InferTypeOf<typeof ContentEntry>
export type ContentKind = ContentEntryRecord["kind"]
export type LandingPageRecord = InferTypeOf<typeof LandingPage>
export type ContentTermRecord = InferTypeOf<typeof ContentTerm>
export type ContentTermKind = ContentTermRecord["kind"]

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * Content pages, blog posts with their categories and tags, and facet
 * landing pages (F3.16). The rules (a checked document, a slug handle, the
 * shop's own images, the page's path, a landing's originality, one
 * category a post) live in the workflows that write here.
 */
class ContentModuleService extends MedusaService({
  ContentEntry,
  LandingPage,
  ContentTerm,
  ContentEntryTerm,
}) {
  /**
   * Stores landing pages' measured shares without touching `updated_at`: a
   * share measured again is no change of the page (IndexNow, list order).
   */
  @InjectManager()
  async setLandingOriginality(
    rows: { id: string; originality: number }[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (rows.length === 0) {
      return
    }
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    await manager.execute(
      `UPDATE landing_page AS l SET originality = r.originality
         FROM jsonb_to_recordset(?::jsonb) AS r(id text, originality integer)
        WHERE l.id = r.id`,
      [JSON.stringify(rows)]
    )
  }

  /**
   * A page of the live posts filed under every one of the terms, the
   * newest first, and how many there are: one statement, however many
   * posts a term holds (a category's or a tag's archive).
   */
  @InjectManager()
  async pageLivePostsUnderTerms(
    termIds: readonly string[],
    page: { skip: number; take: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ ids: string[]; count: number }> {
    if (termIds.length === 0) {
      return { ids: [], count: 0 }
    }
    const manager = sharedContext.manager as Executor
    const filed = termIds
      .map(
        () =>
          `AND e.id IN (SELECT t.entry_id FROM content_entry_term t
                         WHERE t.term_id = ? AND t.deleted_at IS NULL)`
      )
      .join(" ")
    const [row] = (await manager.execute(
      `WITH filed AS (
         SELECT e.id, e.published_at FROM content_entry e
          WHERE e.kind = 'post' AND e.status = 'published' AND e.deleted_at IS NULL ${filed}
       ), page AS (
         SELECT id, published_at FROM filed ORDER BY published_at DESC, id LIMIT ? OFFSET ?
       )
       SELECT (SELECT count(*)::int FROM filed) AS count,
              COALESCE(array_agg(id ORDER BY published_at DESC, id), '{}') AS ids
         FROM page`,
      [...termIds, page.take, page.skip]
    )) as { ids: string[]; count: number }[]
    return { ids: row?.ids ?? [], count: row?.count ?? 0 }
  }

  /**
   * How many posts each term files, counted in one grouped statement:
   * live ones only, or every post not deleted. A term with none is not in
   * the answer. At most `cap` terms, the fullest first. `termIds` null:
   * every term.
   */
  @InjectManager()
  async countPostsByTerm(
    termIds: readonly string[] | null,
    options: { live: boolean; cap: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ term_id: string; count: number }[]> {
    if (termIds?.length === 0) {
      return []
    }
    const manager = sharedContext.manager as Executor
    return (await manager.execute(
      `SELECT t.term_id, count(*)::int AS count
         FROM content_entry_term t
         JOIN content_entry e ON e.id = t.entry_id
        WHERE t.deleted_at IS NULL AND e.deleted_at IS NULL AND e.kind = 'post'
          ${options.live ? "AND e.status = 'published'" : ""}
          ${termIds ? "AND t.term_id IN (SELECT jsonb_array_elements_text(?::jsonb))" : ""}
        GROUP BY t.term_id
        ORDER BY count DESC, t.term_id
        LIMIT ?`,
      [...(termIds ? [JSON.stringify(termIds)] : []), options.cap]
    )) as { term_id: string; count: number }[]
  }
}

export default ContentModuleService
