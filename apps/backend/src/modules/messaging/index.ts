import { Module } from "@medusajs/framework/utils"
import MessagingModuleService from "./service"

/** Commercial consent and the addresses nothing goes to (F9, adr/0036). */
export const MESSAGING_MODULE = "messaging"

export default Module(MESSAGING_MODULE, {
  service: MessagingModuleService,
})
