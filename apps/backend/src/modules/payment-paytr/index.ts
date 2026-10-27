import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PaytrProviderService from "./service"

/** PayTR (adr/0026, adr/0027): registered in medusa-config as `pp_paytr_paytr`. */
export default ModuleProvider(Modules.PAYMENT, { services: [PaytrProviderService] })
