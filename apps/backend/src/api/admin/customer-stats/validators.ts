import { z } from "@medusajs/framework/zod"

/** The most customers asked at once: the panel's biggest list page. */
export const MAX_STATS_CUSTOMERS = 100

const CUSTOMER_ID = /^cus_[0-9A-Za-z]{1,40}$/

/** `?ids=cus_1,cus_2`: the customers whose order totals are read (a list page, one customer). */
export const AdminGetCustomerStats = z
  .object({
    ids: z
      .string()
      .max(MAX_STATS_CUSTOMERS * 46)
      .transform((text) => [...new Set(text.split(",").map((id) => id.trim()))])
      .pipe(z.array(z.string().regex(CUSTOMER_ID)).min(1).max(MAX_STATS_CUSTOMERS)),
  })
  .strict()
export type AdminGetCustomerStatsType = z.infer<typeof AdminGetCustomerStats>
