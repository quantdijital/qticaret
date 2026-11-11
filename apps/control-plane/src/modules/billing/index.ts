import { Module } from "@medusajs/framework/utils"
import BillingModuleService from "./service"

/** Subscriptions, charges, reminders and the payment instruction (adr/0061 §2, §7, Ek C16). */
export const BILLING_MODULE = "billing"

export default Module(BILLING_MODULE, { service: BillingModuleService })
