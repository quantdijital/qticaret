import { Module } from "@medusajs/framework/utils"
import WholesaleModuleService from "./service"

/** Wholesale levels, accounts and their prices (ADR-0068). */
export const WHOLESALE_MODULE = "wholesale"

export default Module(WHOLESALE_MODULE, {
  service: WholesaleModuleService,
})
