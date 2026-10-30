import { Module } from "@medusajs/framework/utils"
import MigrationModuleService from "./service"

/** A shop's data moved from its old platform (F14, adr/0042). */
export const MIGRATION_MODULE = "migration"

export default Module(MIGRATION_MODULE, { service: MigrationModuleService })
