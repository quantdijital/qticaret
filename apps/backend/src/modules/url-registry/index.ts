import { Module } from "@medusajs/framework/utils"
import UrlRegistryModuleService from "./service"

/** Storefront paths unique per locale across every entity type (F2.11, docs/13 §2.1). */
export const URL_REGISTRY_MODULE = "urlRegistry"

export default Module(URL_REGISTRY_MODULE, {
  service: UrlRegistryModuleService,
})
