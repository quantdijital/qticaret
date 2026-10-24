import { Module } from "@medusajs/framework/utils"
import TrAddressModuleService from "./service"

/** Turkish address reference data: provinces, districts, neighborhoods (F1.3, adr/0008). */
export const TR_ADDRESS_MODULE = "trAddress"

export default Module(TR_ADDRESS_MODULE, {
  service: TrAddressModuleService,
})
