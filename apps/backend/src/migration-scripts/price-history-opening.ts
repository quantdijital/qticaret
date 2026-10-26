import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { recordAllSellingPrices } from "../workflows/pricing/price-history"

/**
 * Runs once per shop, on the `db:migrate` that brings the price history
 * (F4.2, ADR-0023): every variant's selling price today opens its history,
 * so the 30-day rule has a price from before the shop's first discount.
 */
export default async function priceHistoryOpening({ container }: ExecArgs) {
  const recorded = await recordAllSellingPrices(container, "opening")
  logger.info({ event: "price_history.opened", recorded })
}
