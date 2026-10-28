import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import YurticiFulfillmentService from "./service"

/** Yurtiçi Kargo (adr/0035): registered in medusa-config as `yurtici_yurtici`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [YurticiFulfillmentService] })
