import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BankTransferProviderService from "./service"

/** Bank transfer (adr/0029): registered in medusa-config as `pp_bank-transfer_bank-transfer`. */
export default ModuleProvider(Modules.PAYMENT, { services: [BankTransferProviderService] })
