import { Module } from "@medusajs/framework/utils"
import IntegrationCredentialsModuleService from "./service"

/** The shop's provider accounts, entered in the panel and stored encrypted (adr/0027). */
export const INTEGRATION_CREDENTIALS_MODULE = "integrationCredentials"

export default Module(INTEGRATION_CREDENTIALS_MODULE, {
  service: IntegrationCredentialsModuleService,
})
