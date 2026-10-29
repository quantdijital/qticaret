import { Module } from "@medusajs/framework/utils"
import AccountingModuleService from "./service"

/** Records sent to the shop's accounting program (F11.5, adr/0039 §5). */
export const ACCOUNTING_MODULE = "accounting"

export default Module(ACCOUNTING_MODULE, { service: AccountingModuleService })
