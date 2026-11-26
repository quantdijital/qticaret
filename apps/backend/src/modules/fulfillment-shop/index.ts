import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ShopFulfillmentService from "./service"

/** The shop's own delivery at a flat price (adr/0087 §2): registered in medusa-config as `shop_shop`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [ShopFulfillmentService] })
