import { Module } from "@medusajs/framework/utils"
import SeoInsightsModuleService from "./service"

/** What Search Console and CrUX say of the shop (F10.11, docs/13 §10). */
export const SEO_INSIGHTS_MODULE = "seo_insights"

export default Module(SEO_INSIGHTS_MODULE, { service: SeoInsightsModuleService })
