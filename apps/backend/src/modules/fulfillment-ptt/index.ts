import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PttFulfillmentService from "./service"

/** PTT Kargo (docs/entegrasyonlar/ptt.md): registered in medusa-config as `ptt_ptt`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [PttFulfillmentService] })
