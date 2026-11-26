import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SuratFulfillmentService from "./service"

/** Sürat Kargo (docs/entegrasyonlar/surat.md): registered in medusa-config as `surat_surat`. */
export default ModuleProvider(Modules.FULFILLMENT, { services: [SuratFulfillmentService] })
