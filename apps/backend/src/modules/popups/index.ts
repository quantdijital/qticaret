import { Module } from "@medusajs/framework/utils"
import PopupsModuleService from "./service"

/** Storefront pop-ups and their daily counters (adr/0080). */
export const POPUPS_MODULE = "popups"

export default Module(POPUPS_MODULE, { service: PopupsModuleService })
