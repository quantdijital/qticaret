import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import CashOnDeliveryProviderService from "./service"

/** Cash on delivery (adr/0029): registered in medusa-config as `pp_cod_cod`. */
export default ModuleProvider(Modules.PAYMENT, { services: [CashOnDeliveryProviderService] })
