import { Module } from "@medusajs/framework/utils"
import FraudGuardModuleService from "./service"

/** The shop's fraud guard (F15.6, adr/0044): block list and suspicious orders. */
export const FRAUD_GUARD_MODULE = "fraud_guard"

export default Module(FRAUD_GUARD_MODULE, { service: FraudGuardModuleService })
