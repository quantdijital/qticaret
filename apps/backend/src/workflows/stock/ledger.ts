import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { checkLowStockStep } from "./steps/check-low-stock"
import { recordStockLevelsStep } from "./steps/record-stock-levels"
import { setStockThresholdStep } from "./steps/set-stock-threshold"
import type { RecordStockInput } from "./steps/record-stock-levels"

/**
 * The stock ledger's one way in (F3.8, adr/0020): what changed at these
 * levels is recorded, then the items that moved are checked for low stock.
 */
export const recordStockWorkflow = createWorkflow("stock-record", (input: RecordStockInput) => {
  const movements = recordStockLevelsStep(input)
  const alerted = checkLowStockStep(
    transform({ movements }, ({ movements }) => movements.map((each) => each.inventory_item_id))
  )
  return new WorkflowResponse({ movements, alerted })
})

/** An item's own threshold; the item is checked against it at once. */
export const setStockThresholdWorkflow = createWorkflow(
  "stock-set-item-threshold",
  (input: { inventory_item_id: string; threshold: number | null }) => {
    const watch = setStockThresholdStep(input)
    checkLowStockStep(transform({ input }, ({ input }) => [input.inventory_item_id]))
    return new WorkflowResponse(watch)
  }
)
