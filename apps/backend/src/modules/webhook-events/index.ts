import { Module } from "@medusajs/framework/utils"
import WebhookEventsModuleService from "./service"

/** Incoming provider notifications, each handled once (adr/0026 §5). */
export const WEBHOOK_EVENTS_MODULE = "webhookEvents"

export default Module(WEBHOOK_EVENTS_MODULE, { service: WebhookEventsModuleService })
