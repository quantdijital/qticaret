import { Module } from "@medusajs/framework/utils"
import StockLedgerModuleService from "./service"

/** Stock movements and low-stock watches (F3.8, adr/0020). */
export const STOCK_LEDGER_MODULE = "stockLedger"

export default Module(STOCK_LEDGER_MODULE, {
  service: StockLedgerModuleService,
})
