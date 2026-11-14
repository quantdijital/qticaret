import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { StorefrontLayout } from "./models/storefront-layout"
import { StorefrontLayoutRevision } from "./models/storefront-layout-revision"

/** Revisions kept; older ones are removed as new ones come (adr/0049). */
export const KEPT_REVISIONS = 20

/** A kept revision without its document: only the menu set it put live, if any. */
export interface RevisionSummary {
  revision: number
  published_at: Date
  published_by: string | null
  /** The document's `settings.menus` as stored (unchecked); null when it has none. */
  menus: unknown
}

/** The storefront's design (adr/0049): its draft, what is live, and earlier publications. */
class StorefrontLayoutModuleService extends MedusaService({
  StorefrontLayout,
  StorefrontLayoutRevision,
}) {
  /**
   * The kept revisions, newest first, each with its menu set but not the
   * rest of its document: the editor reads them at every open and save.
   */
  @InjectManager()
  async revisionSummaries(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RevisionSummary[]> {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("storefront_layout: revisions are read through the manager")
    }
    const rows: RevisionSummary[] = await manager.execute(
      `SELECT revision, published_at, published_by, document->'settings'->'menus' AS menus
       FROM storefront_layout_revision
       WHERE deleted_at IS NULL
       ORDER BY revision DESC`
    )
    return rows.map((row) => ({ ...row, menus: row.menus ?? null }))
  }
}

export default StorefrontLayoutModuleService
