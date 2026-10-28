import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ArasFulfillmentService from "./service"

/** Aras Kargo (adr/0035): registered in medusa-config as `aras_aras`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [ArasFulfillmentService] })
