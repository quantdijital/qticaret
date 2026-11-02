import { Module } from "@medusajs/framework/utils"
import StorefrontLayoutModuleService from "./service"

/** The storefront's design as laid out in the theme editor (adr/0049). */
export const STOREFRONT_LAYOUT_MODULE = "storefront_layout"

export default Module(STOREFRONT_LAYOUT_MODULE, { service: StorefrontLayoutModuleService })
