import { Module } from "@medusajs/framework/utils"
import ConversionsModuleService from "./service"

/** Server-side conversion events and the consent they rest on (F10.9, adr/0038 §4). */
export const CONVERSIONS_MODULE = "conversions"

export default Module(CONVERSIONS_MODULE, { service: ConversionsModuleService })
