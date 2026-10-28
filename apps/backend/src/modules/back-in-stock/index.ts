import { Module } from "@medusajs/framework/utils"
import BackInStockModuleService from "./service"

/** "Tell me when it is back" (F10.5, adr/0037 §4). */
export const BACK_IN_STOCK_MODULE = "back_in_stock"

export default Module(BACK_IN_STOCK_MODULE, { service: BackInStockModuleService })
