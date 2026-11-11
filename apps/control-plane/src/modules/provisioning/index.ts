import { Module } from "@medusajs/framework/utils"
import ProvisioningModuleService from "./service"

/** The setup's runs and steps (adr/0061 §2 `provisioning`, §6, Ek C10). */
export const PROVISIONING_MODULE = "provisioning"

export default Module(PROVISIONING_MODULE, { service: ProvisioningModuleService })
