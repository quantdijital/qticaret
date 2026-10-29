import { model } from "@medusajs/framework/utils"

/**
 * A variant's manufacturer part number (F3.1): with the brand it identifies
 * an item that has no GTIN (docs/14 P-DATA-02). Linked one to one to the
 * variant; the GTIN itself stays in Medusa's `ean`/`upc`/`barcode`. Its
 * unit cost (F11.4, adr/0039 §4): what the shop pays for one, VAT
 * excluded, in kuruş; staff only, never in a feed or the storefront.
 */
export const VariantExtension = model.define("variant_extension", {
  id: model.id({ prefix: "vext" }).primaryKey(),
  mpn: model.text().nullable(),
  cost: model.number().nullable(),
})
