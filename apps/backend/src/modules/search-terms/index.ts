import { Module } from "@medusajs/framework/utils"
import SearchTermsModuleService from "./service"

/** Storefront search terms by day, for the report and the SEO advisor (F11.8, adr/0039 §8). */
export const SEARCH_TERMS_MODULE = "search_terms"

export default Module(SEARCH_TERMS_MODULE, { service: SearchTermsModuleService })
