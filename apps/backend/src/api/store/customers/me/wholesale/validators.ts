import { z } from "@medusajs/framework/zod"

/** No query at all (security review I1): the customer is the session's, nothing else is asked. */
export const StoreGetWholesale = z.object({}).strict()
export type StoreGetWholesaleType = z.infer<typeof StoreGetWholesale>
