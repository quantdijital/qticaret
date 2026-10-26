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
