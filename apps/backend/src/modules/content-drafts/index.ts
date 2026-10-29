import { Module } from "@medusajs/framework/utils"
import ContentDraftsModuleService from "./service"

/** Content drafts from a provider, approved by staff before they show (F10.13, adr/0005). */
export const CONTENT_DRAFTS_MODULE = "content_drafts"

export default Module(CONTENT_DRAFTS_MODULE, { service: ContentDraftsModuleService })
