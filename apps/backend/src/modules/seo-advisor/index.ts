import { Module } from "@medusajs/framework/utils"
import SeoAdvisorModuleService from "./service"

/** Pages' SEO assessments (F3.13, docs/14). */
export const SEO_ADVISOR_MODULE = "seoAdvisor"

export default Module(SEO_ADVISOR_MODULE, {
  service: SeoAdvisorModuleService,
})
