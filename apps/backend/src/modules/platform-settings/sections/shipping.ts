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
  /**
   * An order placed before this hour (Turkey) leaves the same day; null: not
   * set here, the legacy `marketing.feed_same_day_cutoff_hour` stands
   * (`lib/shipping/same-day.ts`). The product page's card and Akakçe say it.
   */
  same_day_cutoff_hour: number | null
  /** The shop's own price by desi (F7.8), cheapest band first; empty: none set. */
  rate_table: ShippingRate[]
  /** Kuruş for every desi past the last band; 0: such a parcel is not offered this way. */
  over_desi_price: number
  /** The page labels are printed on: a label printer's roll, or A4 with four to a sheet. */
  label_format: LabelFormat
  /** The roll's own size when `label_format` is `custom`, in millimetres. */
  label_custom: { width_mm: number; height_mm: number }
  /**
   * The parcel a product without its own weight or measures ships as, in
   * the shop's units (Settings > Store); null: the platform's, 1 kg in
   * 30 × 20 × 10 cm (adr/0054). The carrier measures the real parcel.
   */
  default_parcel: DefaultParcel | null
  /**
   * Whether the packing slip prints the lines' prices and the order's
   * totals; off by default: a slip in a gift's box says no price.
   */
  packing_slip_prices: boolean
  /**
   * The shop's own shipping classes (adr/0087 §1): a product in one adds
   * its surcharge to the order's shipping, the highest once. The built-in
   * "Ücretsiz kargo" (`free`) is not among them. At most 20.
   */
  shipping_classes: ShippingClass[]
}

export interface ShippingClass {
  /** Its key on products: lower-case letters, digits and dashes, never `free`. */
  key: string
  name: string
  /** Kuruş, KDV in, added once per order: 0–100.000 TL. */
  surcharge: number
}

/** The built-in class every shop has (adr/0087 §1): never renamed, never removed. */
export const FREE_SHIPPING_CLASS = "free"

export interface DefaultParcel {
  weight: number
  length: number
  width: number
  height: number
}

export const LABEL_FORMATS = ["100x150", "100x100", "80x80", "a4", "custom"] as const
export type LabelFormat = (typeof LABEL_FORMATS)[number]

const days = (max: number) => z.number().int().min(0).max(max)

// A measure in the shop's units: above zero, as a product's (a tonne in grams at most)
const measure = z.number().positive().max(1_000_000)

/**
 * Shipping rules (F7.8, adr/0031): how long an order takes to leave and to
 * arrive and the same-day hour (the storefront's promise, the products'
 * `shippingDetails`, Akakçe's `expressDeliveryTime`),
 * the shop's price table by desi for shipping options priced by it, and
 * the parcel a product without measures ships as (adr/0054).
 */
export const shippingSection = defineSection<ShippingSettings>(
  "shipping",
  {
    handling_days_min: days(14),
    handling_days_max: days(14),
    transit_days_min: days(30),
    transit_days_max: days(30),
    same_day_cutoff_hour: z.number().int().min(1).max(23).nullable(),
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
    label_format: z.enum(LABEL_FORMATS),
    // Smaller than 70 mm a barcode, the receiver and the address no longer fit legibly
    label_custom: z
      .object({
        width_mm: z.number().int().min(70).max(210),
        height_mm: z.number().int().min(70).max(297),
      })
      .strict(),
    default_parcel: z
      .object({ weight: measure, length: measure, width: measure, height: measure })
      .strict()
      .nullable(),
    packing_slip_prices: z.boolean(),
    shipping_classes: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(/^[a-z0-9][a-z0-9-]{0,39}$/)
              .refine((key) => key !== FREE_SHIPPING_CLASS),
            name: z.string().trim().min(1).max(60),
            surcharge: z.number().int().min(0).max(100_000_00),
          })
          .strict()
      )
      .max(20),
  },
  {
    handling_days_min: 1,
    handling_days_max: 2,
    transit_days_min: 1,
    transit_days_max: 3,
    same_day_cutoff_hour: null,
    rate_table: [],
    over_desi_price: 0,
    label_format: "100x150",
    label_custom: { width_mm: 100, height_mm: 150 },
    default_parcel: null,
    packing_slip_prices: false,
    shipping_classes: [],
  },
  (values, ctx) => {
    if (values.handling_days_min > values.handling_days_max) {
      ctx.addIssue({ code: "custom", path: ["handling_days_max"], message: "shipping.days_order" })
    }
    if (values.transit_days_min > values.transit_days_max) {
      ctx.addIssue({ code: "custom", path: ["transit_days_max"], message: "shipping.days_order" })
    }
    // A class's key names it on products: one class per key
    const keys = values.shipping_classes.map((each) => each.key)
    keys.forEach((key, index) => {
      if (keys.indexOf(key) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping_classes", index, "key"],
          message: "shipping.class_key_taken",
        })
      }
    })
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
