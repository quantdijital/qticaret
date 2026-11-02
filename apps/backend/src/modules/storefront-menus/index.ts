import { Module } from "@medusajs/framework/utils"
import StorefrontMenusModuleService from "./service"

/** The storefront's menus (adr/0049). */
export const STOREFRONT_MENUS_MODULE = "storefront_menus"

export default Module(STOREFRONT_MENUS_MODULE, { service: StorefrontMenusModuleService })
