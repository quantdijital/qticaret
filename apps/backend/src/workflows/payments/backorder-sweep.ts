import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { errorSummary, logger } from "../../lib/logging"
import { BACKORDER_MARK, markEntriesOf } from "../../lib/stock/backorder"
import { recordStockWorkflow } from "../stock/ledger"
import { BACKORDER_LOCK } from "./complete-backorder"
import { alertPaymentIssue } from "./issue-alert"
import { shiftShelf } from "./steps/shelf-raise"

interface MarkedLevel {
  inventory_item_id: string
  location_id: string
  metadata: Record<string, unknown> | null
}

/**
 * Levels still holding a raise for a paid cart's completion. Read from the
 * inventory module's table: Medusa's level filters do not reach into
 * metadata. Writes go through the module.
 */
async function markedLevels(container: MedusaContainer): Promise<MarkedLevel[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  return (await knex("inventory_level")
    .select("inventory_item_id", "location_id", "metadata")
    .whereNull("deleted_at")
    .whereRaw("jsonb_typeof(metadata -> ?) = 'array'", [BACKORDER_MARK])
    .limit(200)) as MarkedLevel[]
}

/**
 * Lowers each raise past its time (adr/0026 Ek 2026-11-06, security review
 * 2026-11-09): a run that raised a level and stopped before lowering it (a
 * crash, a restart) leaves exactly its shortfall on the shelf; the order
 * it was for, if placed, keeps its reservation. Under the completion's own
 * lock, so a raise is lowered once; a busy lock waits for the next minute.
 * The ledger records it and the shop is told. Returns how many it lowered.
 */
export async function sweepBackorderRaises(
  container: MedusaContainer,
  now = Date.now()
): Promise<number> {
  const levels = await markedLevels(container)
  const due = levels.flatMap((level) =>
    markEntriesOf(level.metadata)
      .filter((entry) => Date.parse(entry.expires_at) <= now)
      .map((entry) => ({ level, entry }))
  )
  if (due.length === 0) {
    return 0
  }
  const locking = container.resolve(Modules.LOCKING)
  try {
    return await locking.execute(
      BACKORDER_LOCK,
      async () => {
        let lowered = 0
        for (const { level, entry } of due) {
          const raise = {
            inventory_item_id: level.inventory_item_id,
            location_id: level.location_id,
            quantity: entry.quantity,
          }
          if (!(await shiftShelf(container, raise, entry, "lower"))) {
            continue
          }
          lowered += 1
          logger.error({
            event: "payments.backorder_raise_swept",
            cartId: entry.cart_id,
            inventoryItemId: raise.inventory_item_id,
            units: raise.quantity,
          })
          await recordStockWorkflow(container).run({
            input: {
              levels: [
                { inventory_item_id: raise.inventory_item_id, location_id: raise.location_id },
              ],
              reason: "reconcile",
              reference: `backorder:${entry.cart_id}`,
            },
            throwOnError: false,
          })
          await alertPaymentIssue(container, {
            issue: "shelf_restored",
            provider: "stock",
            reference: `${entry.cart_id}:${raise.inventory_item_id}`,
            cart_id: entry.cart_id,
          })
        }
        return lowered
      },
      { timeout: 2 }
    )
  } catch (error) {
    logger.warn({ event: "payments.backorder_sweep_skipped", err: errorSummary(error) })
    return 0
  }
}
