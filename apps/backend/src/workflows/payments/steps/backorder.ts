import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import type { StockShortLine } from "../../../lib/stock"
import { markStockShort } from "../stock-short-mark"

/**
 * Marks the order with what the shelf lacked (`metadata.stock_short`).
 * Never fails: the order is placed and paid; one that fails is logged.
 * A mark a crash lost is found again from the shelf when the provider's
 * notice comes once more (`markStockShortFromShelf`).
 */
export const markStockShortStep = createStep(
  "payments-mark-stock-short",
  async (input: { order_id: string; short: StockShortLine[] }, { container }) => {
    try {
      return new StepResponse(await markStockShort(container, input.order_id, input.short))
    } catch (error) {
      logger.error({
        event: "payments.stock_short_mark_failed",
        orderId: input.order_id,
        err: errorSummary(error),
      })
      return new StepResponse(false)
    }
  }
)
