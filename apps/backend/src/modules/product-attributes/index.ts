import { Module } from "@medusajs/framework/utils"
import ProductAttributesModuleService from "./service"

/** Tenant-defined product attribute templates and values (F2.4, adr/0013). */
export const PRODUCT_ATTRIBUTES_MODULE = "productAttributes"

export default Module(PRODUCT_ATTRIBUTES_MODULE, {
  service: ProductAttributesModuleService,
})
