import { Module } from "@medusajs/framework/utils"
import PaymentLinksModuleService from "./service"

/** Payment links staff make for a customer to pay through the storefront (adr/0051). */
export const PAYMENT_LINKS_MODULE = "payment_links"

export default Module(PAYMENT_LINKS_MODULE, { service: PaymentLinksModuleService })
