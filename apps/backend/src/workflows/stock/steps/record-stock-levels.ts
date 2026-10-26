import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { reasonOf } from "../../../lib/stock"
import { STOCK_LEDGER_MODULE } from "../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../modules/stock-ledger/service"
import type { MovementReason, StockMovementRecord } from "../../../modules/stock-ledger/service"

export interface LevelKey {
  inventory_item_id: string
  location_id: string
}

export interface RecordStockInput {
  levels: LevelKey[]
  /** Said by the caller (an import, the nightly reconcile); else read from the change. */
  reason?: MovementReason | undefined
  /** The order the change came with, if the event named one. */
  order_id?: string | null | undefined
  reference?: string | null | undefined
  actor_id?: string | null | undefined
}

// One level at a time: two events for it would otherwise read the same last row
const lockKey = (key: LevelKey) => `stock-ledger:${key.inventory_item_id}:${key.location_id}`

async function recordLevel(
  container: MedusaContainer,
  key: LevelKey,
  input: RecordStockInput
): Promise<StockMovementRecord | null> {
  const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
  const inventory = container.resolve(Modules.INVENTORY)
  return container.resolve(Modules.LOCKING).execute(
    lockKey(key),
    async () => {
      // A level that is gone holds nothing
      const [level] = await inventory.listInventoryLevels(
        { inventory_item_id: key.inventory_item_id, location_id: key.location_id },
        { take: 1 }
      )
      const stocked = level?.stocked_quantity ?? 0
      const reserved = level?.reserved_quantity ?? 0
      const last = await ledger.lastMovement(key.inventory_item_id, key.location_id)
      const deltaStocked = stocked - (last?.stocked_after ?? 0)
      const deltaReserved = reserved - (last?.reserved_after ?? 0)
      // Seen already (an event delivered twice, or a writer that recorded itself)
      if (deltaStocked === 0 && deltaReserved === 0) {
        return null
      }
      return ledger.recordMovement({
        ...key,
        delta_stocked: deltaStocked,
        stocked_after: stocked,
        delta_reserved: deltaReserved,
        reserved_after: reserved,
        reason: input.reason ?? reasonOf(deltaStocked, deltaReserved, Boolean(input.order_id)),
        reference: input.reference ?? input.order_id ?? null,
        actor_id: input.actor_id ?? null,
      })
    },
    { timeout: 10 }
  )
}

/**
 * Records what changed at each level since the ledger last saw it (F3.8,
 * adr/0020). Reading the level rather than trusting an event's numbers
 * makes a repeated or late event harmless: it finds nothing new.
 *
 * No compensation: a row records a change that already happened, which a
 * later failure does not undo. Taking it back would only have the next
 * reading write it again, under the wrong reason.
 */
export const recordStockLevelsStep = createStep(
  "stock-record-levels",
  async (input: RecordStockInput, { container }) => {
    const recorded: StockMovementRecord[] = []
    for (const key of input.levels) {
      const movement = await recordLevel(container, key, input)
      if (movement) {
        recorded.push(movement)
      }
    }
    return new StepResponse(recorded)
  }
)
