import { Module } from "@medusajs/framework/utils"
import AiCreditsModuleService from "./service"

/** The AI platform credits: wallets, ledger, operations, top-up requests (adr/0085 §1). */
export const AI_CREDITS_MODULE = "ai_credits"

export default Module(AI_CREDITS_MODULE, { service: AiCreditsModuleService })
