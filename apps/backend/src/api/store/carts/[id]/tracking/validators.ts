import { z } from "@medusajs/framework/zod"

/**
 * The storefront's cookie banner answer for the cart (F10.9, adr/0038
 * §4), with the identifiers the shopper allowed: GA4's client id (from
 * `_ga`), Meta's `_fbp` and `_fbc`, and the page the order is placed from.
 */
export const StorePostCartTracking = z
  .object({
    analytics: z.boolean(),
    marketing: z.boolean(),
    ga_client_id: z
      .string()
      .regex(/^\d{1,12}\.\d{1,12}$/)
      .optional(),
    fbp: z
      .string()
      .regex(/^fb\.\d\.\d{10,16}\.\d{1,20}$/)
      .optional(),
    fbc: z
      .string()
      .regex(/^fb\.\d\.\d{10,16}\.[\w-]{1,500}$/)
      .optional(),
    page_url: z
      .url({ protocol: /^https?$/ })
      .max(2000)
      .optional(),
  })
  .strict()

export type StorePostCartTrackingType = z.infer<typeof StorePostCartTracking>
