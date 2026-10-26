import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { STOCK_LEDGER_MODULE } from "../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../modules/stock-ledger/service"
import { watchLock } from "./check-low-stock"

// The low-stock check makes an item's watch too; under one lock, only one of them makes it
const underWatchLock = <T>(container: MedusaContainer, id: string, job: () => Promise<T>) =>
  container.resolve(Modules.LOCKING).execute(watchLock(id), job, { timeout: 10 })

/** An item's own low-stock threshold (adr/0020); null follows the shop's. */
export const setStockThresholdStep = createStep(
  "stock-set-threshold",
  async (input: { inventory_item_id: string; threshold: number | null }, { container }) => {
    const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    return underWatchLock(container, input.inventory_item_id, async () => {
      const [watch] = await ledger.listStockWatches(
        { inventory_item_id: input.inventory_item_id },
        { take: 1 }
      )
      if (watch) {
        const saved = await ledger.updateStockWatches({ id: watch.id, threshold: input.threshold })
        return new StepResponse(saved, {
          id: watch.id,
          inventory_item_id: input.inventory_item_id,
          threshold: watch.threshold,
          created: false,
        })
      }
      const saved = await ledger.createStockWatches(input)
      return new StepResponse(saved, {
        id: saved.id,
        inventory_item_id: input.inventory_item_id,
        threshold: null,
        created: true,
      })
    })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    await underWatchLock(container, undo.inventory_item_id, async () => {
      if (undo.created) {
        await ledger.deleteStockWatches([undo.id])
      } else {
        await ledger.updateStockWatches({ id: undo.id, threshold: undo.threshold })
      }
    })
  }
)
