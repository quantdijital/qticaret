import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import GeliverFulfillmentService from "./service"

/** Geliver (adr/0031): registered in medusa-config as `geliver_geliver`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [GeliverFulfillmentService] })
