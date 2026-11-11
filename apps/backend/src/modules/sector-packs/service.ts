import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { SectorPackApplication } from "./models/sector-pack-application"
import { SectorPackItem } from "./models/sector-pack-item"
import type { PackItemKind, PackItemOutcome } from "./models/sector-pack-item"

export interface OfferedItem {
  key: string
  kind: PackItemKind
  outcome: PackItemOutcome
  record_id: string | null
}

/**
 * The sector packs applied here and the record of every item each offered
 * (adr/0061 C12). The record is what makes a re-apply only add: an item
 * found in it is never offered again, whatever the shop did with it since.
 */
class SectorPacksModuleService extends MedusaService({
  SectorPackItem,
  SectorPackApplication,
}) {
  /** The items of `pack` offered here before, by key. */
  @InjectManager()
  async offeredItems(
    pack: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, OfferedItem>> {
    const rows = await this.listSectorPackItems(
      { pack },
      { select: ["key", "kind", "outcome", "record_id"], take: null },
      sharedContext
    )
    return new Map(
      rows.map((row) => [
        row.key,
        { key: row.key, kind: row.kind, outcome: row.outcome, record_id: row.record_id },
      ])
    )
  }

  /**
   * An item recorded as offered. A second record of the same item (two
   * applies at once) is no error: the first one stands.
   */
  async recordItem(pack: string, version: number, item: OfferedItem): Promise<void> {
    try {
      await this.createSectorPackItems({ pack, version, ...item })
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("key")) {
        throw error
      }
    }
  }

  /** The pack applied at `version` now; an older version never lowers the one recorded. */
  async markApplied(pack: string, version: number, at: Date = new Date()): Promise<void> {
    const [current] = await this.listSectorPackApplications({ pack }, { take: 1 })
    if (!current) {
      await this.createSectorPackApplications({ pack, version, applied_at: at })
      return
    }
    await this.updateSectorPackApplications({
      id: current.id,
      version: Math.max(current.version, version),
      applied_at: at,
    })
  }
}

export default SectorPacksModuleService
