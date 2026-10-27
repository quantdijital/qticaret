import { z } from "@medusajs/framework/zod"

export const DevGetCheckoutOrder = z
  .object({ cart_id: z.string().regex(/^cart_[A-Za-z0-9]{1,64}$/) })
  .strict()

export type DevGetCheckoutOrderType = z.infer<typeof DevGetCheckoutOrder>
