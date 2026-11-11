import { Module } from "@medusajs/framework/utils"
import PlansModuleService from "./service"

/** Packages, their limits, the package each shop is on and its own exceptions (adr/0061 §2). */
export const PLANS_MODULE = "plans"

export default Module(PLANS_MODULE, { service: PlansModuleService })
