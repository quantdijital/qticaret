import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import type { PriceRecordReason } from "../../modules/price-history/service"
import { recordSellingPricesStep } from "./steps/record-selling-prices"
import type { RecordSellingPricesInput } from "./steps/record-selling-prices"

/** The price history's one way in (F4.2, ADR-0023): these variants' selling prices, where they changed. */
export const recordSellingPricesWorkflow = createWorkflow(
  "price-history-record",
  (input: RecordSellingPricesInput) => new WorkflowResponse(recordSellingPricesStep(input))
)

const PAGE = 200

async function recordPages(container: MedusaContainer, reason: PriceRecordReason) {
  const product = container.resolve(Modules.PRODUCT)
  let recorded = 0
  for (let skip = 0; ; skip += PAGE) {
    const variants = await product.listProductVariants(
      {},
      { select: ["id"], skip, take: PAGE, order: { id: "ASC" } }
    )
    if (variants.length > 0) {
      try {
        const { result } = await recordSellingPricesWorkflow(container).run({
          input: { variant_ids: variants.map((variant) => variant.id), reason },
        })
        recorded += result
      } catch (error) {
        logger.warn({ event: "price_history.page_failed", skip, err: errorSummary(error) })
      }
    }
    if (variants.length < PAGE) {
      return recorded
    }
  }
}

/**
 * Every variant's selling price, recorded where it changed (ADR-0023): the
 * hourly check finds a price list that began or ended (no event tells of
 * it) and what events missed; the first run on a shop opens its history.
 * A page that fails is logged and skipped; the next run writes it. One run
 * at a time across processes: another that finds it running gives up
 * (throws). Returns the records written.
 */
export async function recordAllSellingPrices(
  container: MedusaContainer,
  reason: PriceRecordReason
): Promise<number> {
  return container
    .resolve(Modules.LOCKING)
    .execute("price-history-all", () => recordPages(container, reason), { timeout: 1 })
}
