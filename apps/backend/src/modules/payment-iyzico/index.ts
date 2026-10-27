import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import IyzicoProviderService from "./service"

/** iyzico's Checkout Form (adr/0026, adr/0027): registered in medusa-config as `pp_iyzico_iyzico`. */
export default ModuleProvider(Modules.PAYMENT, { services: [IyzicoProviderService] })
