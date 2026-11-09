import type { InventoryTypes, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import {
  BACKORDER_RAISE_TTL_MS,
  markEntriesOf,
  withMarkEntries,
} from "../../../lib/stock/backorder"
import type { BackorderMarkEntry, ShelfRaise } from "../../../lib/stock/backorder"
import { recordStockWorkflow } from "../../stock/ledger"
import type { RecordStockInput } from "../../stock/steps/record-stock-levels"

type Container = Pick<MedusaContainer, "resolve">

export interface ShelfRaiseInput {
  cart_id: string
  raises: ShelfRaise[]
}

/**
 * Raises a level by a cart's shortfall and marks the raise on it, or
 * lowers it by a raise still marked and takes the mark off. Lowering
 * what is not marked does nothing, so a raise is lowered once whoever
 * gets to it (the run, its compensation, the sweeper). Medusa's level
 * update takes any stocked quantity, below what is reserved too (2.21.2,
 * inventory module `updateInventoryLevels_`: no bound is checked).
 */
export async function shiftShelf(
  container: Container,
  raise: ShelfRaise,
  entry: BackorderMarkEntry,
  change: "raise" | "lower"
): Promise<boolean> {
  const inventory = container.resolve(Modules.INVENTORY)
  const [level] = await inventory.listInventoryLevels(
    { inventory_item_id: raise.inventory_item_id, location_id: raise.location_id },
    { take: 1, select: ["id", "stocked_quantity", "metadata"] }
  )
  if (!level) {
    return false
  }
  const entries = markEntriesOf(level.metadata)
  let next: BackorderMarkEntry[]
  if (change === "raise") {
    next = [...entries, entry]
  } else {
    const index = entries.findIndex(
      (each) => each.cart_id === entry.cart_id && each.quantity === entry.quantity
    )
    if (index === -1) {
      return false
    }
    next = entries.filter((_, at) => at !== index)
  }
  const sign = change === "raise" ? 1 : -1
  // The level and its mark in one write, so a crash leaves both or neither. The level
  // model keeps `metadata` and the module passes it through (2.21.2: only
  // `reserved_quantity` is stripped), though the update's type does not name it
  const update = {
    inventory_item_id: raise.inventory_item_id,
    location_id: raise.location_id,
    stocked_quantity: level.stocked_quantity + sign * raise.quantity,
    metadata: withMarkEntries(level.metadata, next),
  } as InventoryTypes.UpdateInventoryLevelInput
  await inventory.updateInventoryLevels([update])
  return true
}

const entryOf = (input: ShelfRaiseInput, raise: ShelfRaise, now: number): BackorderMarkEntry => ({
  cart_id: input.cart_id,
  quantity: raise.quantity,
  expires_at: new Date(now + BACKORDER_RAISE_TTL_MS).toISOString(),
})

/**
 * Raises each level by what the cart's order lacks there, so Medusa's
 * completion can reserve it (adr/0026 Ek 2026-11-06). Lowered again if
 * anything after it fails; the sweeper lowers one a crash left behind.
 */
export const raiseShelfStep = createStep(
  "payments-raise-shelf",
  async (input: ShelfRaiseInput, { container }) => {
    const now = Date.now()
    const done: BackorderMarkEntry[] = []
    const raised: ShelfRaise[] = []
    for (const raise of input.raises) {
      const entry = entryOf(input, raise, now)
      if (await shiftShelf(container, raise, entry, "raise")) {
        raised.push(raise)
        done.push(entry)
      }
    }
    return new StepResponse({ raised, entries: done }, { raised, entries: done })
  },
  async (made, { container }) => {
    for (const [index, raise] of (made?.raised ?? []).entries()) {
      const entry = made?.entries[index]
      if (entry) {
        await shiftShelf(container, raise, entry, "lower")
      }
    }
  }
)

/**
 * Records the levels' moves in the stock ledger now, with their own
 * reason, so the raise, the order's reservation and the lowering are
 * three rows, not one. Never fails: the ledger reads the level again on
 * Medusa's next event for it, under a reason worked out from the change.
 */
export const recordBackorderLedgerStep = createStep(
  "payments-backorder-ledger",
  async (input: RecordStockInput, { container }) => {
    if (input.levels.length === 0) {
      return new StepResponse(false)
    }
    const { errors } = await recordStockWorkflow(container).run({ input, throwOnError: false })
    if (errors[0]) {
      logger.warn({
        event: "payments.backorder_ledger_failed",
        reference: input.reference ?? input.order_id ?? null,
        err: errorSummary(errors[0].error),
      })
    }
    return new StepResponse(errors.length === 0)
  }
)

/**
 * Lowers what the run raised, once the order holds its reservation. Never
 * fails: the order stands; a raise left marked is lowered by the sweeper
 * when it expires, and the shop is told then.
 */
export const lowerShelfStep = createStep(
  "payments-lower-shelf",
  async (input: { raised: ShelfRaise[]; entries: BackorderMarkEntry[] }, { container }) => {
    let lowered = 0
    for (const [index, raise] of input.raised.entries()) {
      const entry = input.entries[index]
      if (!entry) {
        continue
      }
      try {
        lowered += (await shiftShelf(container, raise, entry, "lower")) ? 1 : 0
      } catch (error) {
        logger.error({
          event: "payments.backorder_lower_failed",
          cartId: entry.cart_id,
          inventoryItemId: raise.inventory_item_id,
          err: errorSummary(error),
        })
      }
    }
    return new StepResponse(lowered)
  }
)
