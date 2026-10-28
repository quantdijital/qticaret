import { Module } from "@medusajs/framework/utils"
import MarketingFeedsModuleService from "./service"

/** Product feeds for Google, Meta and price comparison sites (F10.8, adr/0038 §3). */
export const MARKETING_FEEDS_MODULE = "marketing_feeds"

export default Module(MARKETING_FEEDS_MODULE, { service: MarketingFeedsModuleService })
