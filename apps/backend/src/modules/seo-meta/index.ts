import { Module } from "@medusajs/framework/utils"
import SeoMetaModuleService from "./service"

/** Pages' own SEO fields (adr/0015, F3.4). */
export const SEO_META_MODULE = "seoMeta"

export default Module(SEO_META_MODULE, {
  service: SeoMetaModuleService,
})
