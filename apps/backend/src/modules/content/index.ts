import { Module } from "@medusajs/framework/utils"
import ContentModuleService from "./service"

/** Content pages and blog posts (F3.16, adr/0019). */
export const CONTENT_MODULE = "content"

export default Module(CONTENT_MODULE, {
  service: ContentModuleService,
})
