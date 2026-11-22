import { z } from "@medusajs/framework/zod"
import { BOOKING_MODES, DATED_SCHEMA_TYPES, PRODUCT_KINDS } from "@qticaret/sector-packs"
import { defineSection } from "./define"

/**
 * The shop's catalog defaults (adr/0076 §12): what a new product starts as
 * in the panel's wizard, and the structured data a dated product's page
 * adds beside its `Product` (§10). A sector pack sets them once; the shop
 * may change them. Nothing here changes a product already made.
 */
export interface CatalogSettings {
  new_product_kind: (typeof PRODUCT_KINDS)[number]
  /** `departure`: a new service starts sold by date (needs `catalog.booking` to take effect). */
  new_product_booking_mode: (typeof BOOKING_MODES)[number]
  dated_schema_type: (typeof DATED_SCHEMA_TYPES)[number]
}

export const catalogSection = defineSection<CatalogSettings>(
  "catalog",
  {
    new_product_kind: z.enum(PRODUCT_KINDS),
    new_product_booking_mode: z.enum(BOOKING_MODES),
    dated_schema_type: z.enum(DATED_SCHEMA_TYPES),
  },
  {
    new_product_kind: "physical",
    new_product_booking_mode: "none",
    dated_schema_type: "TouristTrip",
  },
  (values, ctx) => {
    // adr/0076 §2: a product sold by date is a service
    if (values.new_product_booking_mode !== "none" && values.new_product_kind !== "service") {
      ctx.addIssue({
        code: "custom",
        message: "catalog.booking_kind",
        path: ["new_product_booking_mode"],
      })
    }
  }
)
