import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { StorefrontDesign } from "./models/storefront-design"
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

/** A saved look (adr/0064) without its document: what the list and its cards show. */
export interface DesignSummaryRow {
  id: string
  kind: "saved" | "auto"
  name: string | null
  digest: string
  /** As stored (`lib/storefront/designs/summary.ts`), unchecked. */
  summary: unknown
  created_by: string | null
  applied_at: Date | null
  created_at: Date
  updated_at: Date
}

/** The storefront's design (adr/0049): its draft, what is live, earlier publications, saved looks. */
class StorefrontLayoutModuleService extends MedusaService({
  StorefrontLayout,
  StorefrontLayoutRevision,
  StorefrontDesign,
}) {
  private manager(sharedContext: Context): EntityManager {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("storefront_layout: summaries are read through the manager")
    }
    return manager
  }

  /**
   * The kept revisions, newest first, each with its menu set but not the
   * rest of its document: the editor reads them at every open and save.
   */
  @InjectManager()
  async revisionSummaries(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RevisionSummary[]> {
    const rows: RevisionSummary[] = await this.manager(sharedContext).execute(
      `SELECT revision, published_at, published_by, document->'settings'->'menus' AS menus
       FROM storefront_layout_revision
       WHERE deleted_at IS NULL
       ORDER BY revision DESC`
    )
    return rows.map((row) => ({ ...row, menus: row.menus ?? null }))
  }

  /**
   * The saved looks, newest first, without their documents (adr/0064 §7):
   * the gallery reads them at every open; fifteen rows at most.
   */
  @InjectManager()
  async designSummaries(@MedusaContext() sharedContext: Context = {}): Promise<DesignSummaryRow[]> {
    return this.manager(sharedContext).execute(
      `SELECT id, kind, name, digest, summary, created_by, applied_at, created_at, updated_at
       FROM storefront_design
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC, id DESC`
    )
  }
}

export default StorefrontLayoutModuleService
