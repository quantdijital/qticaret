import { z } from "@medusajs/framework/zod"

/** No query at all: the order is the path's, its access the session's or its key's. */
export const StoreGetOrderWholesale = z.object({}).strict()
export type StoreGetOrderWholesaleType = z.infer<typeof StoreGetOrderWholesale>
