import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { STOCK_LEDGER_MODULE } from "../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../modules/stock-ledger/service"

/** An item's own low-stock threshold (adr/0020); null follows the shop's. */
export const setStockThresholdStep = createStep(
  "stock-set-threshold",
  async (input: { inventory_item_id: string; threshold: number | null }, { container }) => {
    const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    const [watch] = await ledger.listStockWatches(
      { inventory_item_id: input.inventory_item_id },
      { take: 1 }
    )
    if (watch) {
      const saved = await ledger.updateStockWatches({ id: watch.id, threshold: input.threshold })
      return new StepResponse(saved, { id: watch.id, threshold: watch.threshold, created: false })
    }
    const saved = await ledger.createStockWatches(input)
    return new StepResponse(saved, { id: saved.id, threshold: null, created: true })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    if (undo.created) {
      await ledger.deleteStockWatches([undo.id])
    } else {
      await ledger.updateStockWatches({ id: undo.id, threshold: undo.threshold })
    }
  }
)
