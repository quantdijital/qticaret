import { Module } from "@medusajs/framework/utils"
import AiModuleService from "./service"

/** The AI core's records: calls, chosen services, the day's ceiling (adr/0071 §5). */
export const AI_MODULE = "ai"

export default Module(AI_MODULE, { service: AiModuleService })
