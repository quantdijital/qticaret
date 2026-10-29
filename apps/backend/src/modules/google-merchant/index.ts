import { Module } from "@medusajs/framework/utils"
import GoogleMerchantModuleService from "./service"

/** The shop's Google connection under way and its Merchant Center products (F10 M13). */
export const GOOGLE_MERCHANT_MODULE = "google_merchant"

export default Module(GOOGLE_MERCHANT_MODULE, { service: GoogleMerchantModuleService })
