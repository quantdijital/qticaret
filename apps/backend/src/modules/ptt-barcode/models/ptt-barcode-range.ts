import { model } from "@medusajs/framework/utils"

/**
 * A range of parcel barcodes PTT gave the shop (docs/entegrasyonlar/ptt.md):
 * its first and last twelve-digit numbers and the next one to hand out,
 * all as twelve digits (`next_number` passes `last_number` by one when the
 * range is used up). A number handed out is never handed out again, even
 * when its parcel was deleted or refused: PTT may keep a half record.
 */
export const PttBarcodeRange = model
  .define("ptt_barcode_range", {
    id: model.id({ prefix: "pttbr" }).primaryKey(),
    first_number: model.text(),
    last_number: model.text(),
    next_number: model.text(),
  })
  .indexes([{ on: ["first_number"], unique: true, where: "deleted_at IS NULL" }])
