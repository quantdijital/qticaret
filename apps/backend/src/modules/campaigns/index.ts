import { Module } from "@medusajs/framework/utils"
import CampaignsModuleService from "./service"

/** Bulk e-mail and SMS to consented customers (adr/0050). */
export const CAMPAIGNS_MODULE = "campaigns"

export default Module(CAMPAIGNS_MODULE, { service: CampaignsModuleService })
