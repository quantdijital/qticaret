import { Module } from "@medusajs/framework/utils"
import StatementChecksModuleService from "./service"

/** Payment providers' statements checked against the shop's payments (F11.3, adr/0039 §3). */
export const STATEMENT_CHECKS_MODULE = "statement_checks"

export default Module(STATEMENT_CHECKS_MODULE, { service: StatementChecksModuleService })
