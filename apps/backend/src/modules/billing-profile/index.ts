import { Module } from "@medusajs/framework/utils"
import BillingProfileModuleService from "./service"

/** Customer invoice identity with encrypted TCKN/VKN (F1.5, adr/0009). */
export const BILLING_PROFILE_MODULE = "billingProfile"

export default Module(BILLING_PROFILE_MODULE, {
  service: BillingProfileModuleService,
})
