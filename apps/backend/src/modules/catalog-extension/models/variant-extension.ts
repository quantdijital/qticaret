import { model } from "@medusajs/framework/utils"

/**
 * A variant's manufacturer part number (F3.1): with the brand it identifies
 * an item that has no GTIN (docs/14 P-DATA-02). Linked one to one to the
 * variant; the GTIN itself stays in Medusa's `ean`/`upc`/`barcode`.
 */
export const VariantExtension = model.define("variant_extension", {
  id: model.id({ prefix: "vext" }).primaryKey(),
  mpn: model.text().nullable(),
})
