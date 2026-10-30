import { Module } from "@medusajs/framework/utils"
import EinvoiceModuleService from "./service"

/** Orders' invoices, issued by the shop's program (F8, adr/0034). */
export const EINVOICE_MODULE = "einvoice"

export default Module(EINVOICE_MODULE, { service: EinvoiceModuleService })
