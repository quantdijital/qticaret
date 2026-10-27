import { Module } from "@medusajs/framework/utils"
import OrderRefundsModuleService from "./service"

/** The order refund ledger (F5 V5). */
export const ORDER_REFUNDS_MODULE = "orderRefunds"

export default Module(ORDER_REFUNDS_MODULE, { service: OrderRefundsModuleService })
