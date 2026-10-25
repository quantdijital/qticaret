import { Module } from "@medusajs/framework/utils"
import SeoSitemapsModuleService from "./service"

/** Generated sitemap files and their refresh state (F3.6). */
export const SEO_SITEMAPS_MODULE = "seoSitemaps"

export default Module(SEO_SITEMAPS_MODULE, {
  service: SeoSitemapsModuleService,
})
