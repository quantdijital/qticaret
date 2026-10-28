import { z } from "@medusajs/framework/zod"

/** "Find my order": the number on the order and the address it was placed with. */
export const StorePostOrderLookup = z
  .object({
    display_id: z.coerce.number().int().positive().max(2_000_000_000),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  })
  .strict()

export type StorePostOrderLookupType = z.infer<typeof StorePostOrderLookup>
