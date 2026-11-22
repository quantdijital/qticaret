import { z } from "@medusajs/framework/zod"

/** The region whose currency the page's prices are read in (lira without one); nothing else. */
export const StoreGetProductBooking = z
  .object({ region_id: z.string().min(1).max(64).optional() })
  .strict()

export type StoreGetProductBookingType = z.infer<typeof StoreGetProductBooking>
