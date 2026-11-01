import { Module } from "@medusajs/framework/utils"
import ContactMessagesModuleService from "./service"

/** The storefront's contact form (F18 D10, adr/0047). */
export const CONTACT_MESSAGES_MODULE = "contact_messages"

export default Module(CONTACT_MESSAGES_MODULE, { service: ContactMessagesModuleService })
