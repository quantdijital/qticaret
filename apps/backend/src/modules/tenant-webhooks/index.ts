import { Module } from "@medusajs/framework/utils"
import TenantWebhooksModuleService from "./service"

/** Events sent to the shop's own systems (F11.7, adr/0039 §7). */
export const TENANT_WEBHOOKS_MODULE = "tenant_webhooks"

export default Module(TENANT_WEBHOOKS_MODULE, { service: TenantWebhooksModuleService })
