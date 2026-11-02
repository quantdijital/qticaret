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
}

export default ContentModuleService
