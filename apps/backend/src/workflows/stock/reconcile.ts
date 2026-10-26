import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { recordStockWorkflow } from "./ledger"

const PAGE = 200

async function reconcilePages(container: MedusaContainer): Promise<number> {
  const inventory = container.resolve(Modules.INVENTORY)
  let recorded = 0
  for (let skip = 0; ; skip += PAGE) {
    // A deleted level too: one whose delete the ledger missed still shows stock there
    const levels = await inventory.listInventoryLevels(
      {},
      {
        select: ["inventory_item_id", "location_id"],
        skip,
        take: PAGE,
        order: { id: "ASC" },
        withDeleted: true,
      }
    )
    if (levels.length > 0) {
      try {
        const { result } = await recordStockWorkflow(container).run({
          input: {
            levels: levels.map(({ inventory_item_id, location_id }) => ({
              inventory_item_id,
              location_id,
            })),
            reason: "reconcile",
          },
        })
        recorded += result.movements.length
      } catch (error) {
        logger.warn({ event: "stock.reconcile_failed", skip, err: errorSummary(error) })
      }
    }
    if (levels.length < PAGE) {
      return recorded
    }
  }
}

/**
 * Reads every stock level and writes what the ledger lacks as `reconcile`
 * (F3.8, adr/0020): the changes no event told it about, and the opening
 * balance of a level it has never seen; the items it writes for are checked
 * for low stock, which arms the ones above their line. A page that fails is
 * logged and skipped; the next run writes it. One run at a time across
 * processes: another that finds it running waits a second, then gives up
 * (throws). Returns the movements written.
 */
export async function reconcileStock(container: MedusaContainer): Promise<number> {
  return container
    .resolve(Modules.LOCKING)
    .execute("stock-reconcile", () => reconcilePages(container), { timeout: 1 })
}
