import { Module } from "@medusajs/framework/utils"
import TenantsModuleService from "./service"

/** The shops the platform runs and what it knows of them (adr/0061 §2). */
export const TENANTS_MODULE = "tenants"

export default Module(TENANTS_MODULE, { service: TenantsModuleService })
