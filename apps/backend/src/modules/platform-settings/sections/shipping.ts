import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface ShippingRate {
  /** Up to this many desi (one decimal). */
  max_desi: number
  /** Kuruş, tax included. */
  price: number
}

export interface ShippingSettings {
  /** Working days to get an order out of the door. */
  handling_days_min: number
  handling_days_max: number
  /** Days the carrier takes to the door. */
  transit_days_min: number
  transit_days_max: number
  /** The shop's own price by desi (F7.8), cheapest band first; empty: none set. */
  rate_table: ShippingRate[]
  /** Kuruş for every desi past the last band; 0: such a parcel is not offered this way. */
  over_desi_price: number
}

const days = (max: number) => z.number().int().min(0).max(max)

/**
 * Shipping rules (F7.8, adr/0031): how long an order takes to leave and to
 * arrive (the storefront's promise and the products' `shippingDetails`),
 * and the shop's price table by desi for shipping options priced by it.
 */
export const shippingSection = defineSection<ShippingSettings>(
  "shipping",
  {
    handling_days_min: days(14),
    handling_days_max: days(14),
    transit_days_min: days(30),
    transit_days_max: days(30),
    rate_table: z
      .array(
        z
          .object({
            max_desi: z.number().positive().max(1_000),
            price: z.number().int().min(0).max(100_000_00),
          })
          .strict()
      )
      .max(20),
    over_desi_price: z.number().int().min(0).max(100_000),
  },
  {
    handling_days_min: 1,
    handling_days_max: 2,
    transit_days_min: 1,
    transit_days_max: 3,
    rate_table: [],
    over_desi_price: 0,
  },
  (values, ctx) => {
    if (values.handling_days_min > values.handling_days_max) {
      ctx.addIssue({ code: "custom", path: ["handling_days_max"], message: "shipping.days_order" })
    }
    if (values.transit_days_min > values.transit_days_max) {
      ctx.addIssue({ code: "custom", path: ["transit_days_max"], message: "shipping.days_order" })
    }
    // Bands rise in desi, each up to a tenth: a parcel falls in exactly one
    values.rate_table.forEach((row, index) => {
      const previous = values.rate_table[index - 1]
      if (
        Math.round(row.max_desi * 10) !== row.max_desi * 10 ||
        (previous && previous.max_desi >= row.max_desi)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["rate_table", index, "max_desi"],
          message: "shipping.rate_table_order",
        })
      }
    })
  }
)
