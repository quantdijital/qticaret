import { Module } from "@medusajs/framework/utils"
import PriceHistoryModuleService from "./service"

/** The selling price history (F4.2, ADR-0023). */
export const PRICE_HISTORY_MODULE = "priceHistory"

export default Module(PRICE_HISTORY_MODULE, {
  service: PriceHistoryModuleService,
})
