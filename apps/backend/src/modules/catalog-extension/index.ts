import { Module } from "@medusajs/framework/utils"
import CatalogExtensionModuleService from "./service"

/** Product and variant fields Medusa has no column for (F3.1). */
export const CATALOG_EXTENSION_MODULE = "catalogExtension"

export default Module(CATALOG_EXTENSION_MODULE, {
  service: CatalogExtensionModuleService,
})
