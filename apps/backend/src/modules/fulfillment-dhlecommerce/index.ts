import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import DhlEcomFulfillmentService from "./service"

/** DHL eCommerce, formerly MNG Kargo: registered in medusa-config as `dhlecommerce_dhlecommerce`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [DhlEcomFulfillmentService] })
