import { Module } from "@medusajs/framework/utils"
import ApiKeyScopesModuleService from "./service"

/** What each secret API key may reach (F11.6, adr/0039 §6). */
export const API_KEY_SCOPES_MODULE = "api_key_scopes"

export default Module(API_KEY_SCOPES_MODULE, { service: ApiKeyScopesModuleService })
