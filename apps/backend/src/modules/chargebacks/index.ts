import { Module } from "@medusajs/framework/utils"
import ChargebacksModuleService from "./service"

/** Cardholders' disputes of order payments (F6.7, adr/0030). */
export const CHARGEBACKS_MODULE = "chargebacks"

export default Module(CHARGEBACKS_MODULE, { service: ChargebacksModuleService })
