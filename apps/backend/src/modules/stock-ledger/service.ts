import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { StockMovement } from "./models/stock-movement"
import { StockWatch } from "./models/stock-watch"

export type StockMovementRecord = InferTypeOf<typeof StockMovement>
export type StockWatchRecord = InferTypeOf<typeof StockWatch>
export type MovementReason = StockMovementRecord["reason"]

export interface MovementInput {
  inventory_item_id: string
  location_id: string
  delta_stocked: number
  stocked_after: number
  delta_reserved: number
  reserved_after: number
  reason: MovementReason
  reference?: string | null
  actor_id?: string | null
}

// Items asked about in one statement
const ITEMS_PER_READ = 1_000

function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "stock movements are append-only")
}

/**
 * The stock ledger (F3.8, adr/0020): movements are appended and read, never
 * changed or taken back; each records a change that already happened.
 * Watches (thresholds, alert state) are ordinary records.
 */
class StockLedgerModuleService extends MedusaService({ StockMovement, StockWatch }) {
  /** The level's last recorded state, or null before its first movement. */
  @InjectManager()
  async lastMovement(
    inventoryItemId: string,
    locationId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StockMovementRecord | null> {
    const [last] = await this.listStockMovements(
      { inventory_item_id: inventoryItemId, location_id: locationId },
      { order: { seq: "DESC" }, take: 1 },
      sharedContext
    )
    return last ?? null
  }

  /**
   * What was on the shelf of each item at `at`, its locations together
   * (F11.4): a level's last movement up to then, or, for a level whose
   * first movement came later, the quantity that movement started from.
   * An item with no movement at all is left out: its level has not changed
   * since the ledger began, so it is what it is now.
   */
  @InjectManager()
  async stockedAt(
    itemIds: readonly string[],
    at: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, number>> {
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    const stocked = new Map<string, number>()
    for (let start = 0; start < itemIds.length; start += ITEMS_PER_READ) {
      const ids = itemIds.slice(start, start + ITEMS_PER_READ)
      const rows = (await manager.execute(
        `SELECT inventory_item_id, sum(quantity)::integer AS stocked FROM (
           SELECT DISTINCT ON (inventory_item_id, location_id) inventory_item_id,
                  CASE WHEN created_at <= ? THEN stocked_after
                       ELSE stocked_after - delta_stocked END AS quantity
             FROM stock_movement
            WHERE deleted_at IS NULL AND inventory_item_id IN (${ids.map(() => "?").join(", ")})
            ORDER BY inventory_item_id, location_id, (created_at <= ?) DESC,
                     CASE WHEN created_at <= ? THEN -seq ELSE seq END
         ) levels GROUP BY inventory_item_id`,
        [at, ...ids, at, at]
      )) as { inventory_item_id: string; stocked: number }[]
      for (const row of rows) {
        stocked.set(row.inventory_item_id, row.stocked)
      }
    }
    return stocked
  }

  async recordMovement(input: MovementInput): Promise<StockMovementRecord> {
    return super.createStockMovements({
      ...input,
      reference: input.reference ?? null,
      actor_id: input.actor_id ?? null,
    })
  }

  override createStockMovements = refuseWrite
  override updateStockMovements = refuseWrite
  override deleteStockMovements = refuseWrite
  override softDeleteStockMovements = refuseWrite
  override restoreStockMovements = refuseWrite
}

export default StockLedgerModuleService
