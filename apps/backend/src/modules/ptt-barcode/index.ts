import { Module } from "@medusajs/framework/utils"
import PttBarcodeModuleService from "./service"

/** The shop's PTT barcode ranges (docs/entegrasyonlar/ptt.md): numbers handed out once each. */
export const PTT_BARCODE_MODULE = "ptt_barcode"

export default Module(PTT_BARCODE_MODULE, { service: PttBarcodeModuleService })
