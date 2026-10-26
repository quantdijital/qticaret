import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { recordAllSellingPrices } from "../workflows/pricing/price-history"

/**
 * The price history's hourly check (F4.2, ADR-0023): a price list that
 * began or ended changes what shoppers pay with no event; this records it
 * within the hour, and whatever events missed.
 */
export default async function priceHistoryReconcile(container: MedusaContainer) {
  try {
    const recorded = await recordAllSellingPrices(container, "reconcile")
    logger.info({ event: "price_history.reconciled", recorded })
  } catch (error) {
    // Another process is running it
    logger.warn({ event: "price_history.reconcile_skipped", err: errorSummary(error) })
  }
}

export const config = {
  name: "price-history-reconcile",
  schedule: "7 * * * *",
}
