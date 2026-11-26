import { z } from "@medusajs/framework/zod"

// Twelve digits, as PTT gives a range's ends (the check digit is ours to add)
const serial = z
  .string()
  .trim()
  .regex(/^\d{12}$/, "ptt.barcode_range_invalid")

/** A barcode range PTT gave the shop (docs/entegrasyonlar/ptt.md). */
export const AdminPostPttBarcodeRange = z.object({ first: serial, last: serial }).strict()

export type AdminPostPttBarcodeRangeType = z.infer<typeof AdminPostPttBarcodeRange>
