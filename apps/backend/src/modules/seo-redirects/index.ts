import { Module } from "@medusajs/framework/utils"
import SeoRedirectsModuleService from "./service"

/** Redirect rules and the 404 log (adr/0017, F3.5). */
export const SEO_REDIRECTS_MODULE = "seoRedirects"

export default Module(SEO_REDIRECTS_MODULE, {
  service: SeoRedirectsModuleService,
})
