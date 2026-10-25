import { z } from "@medusajs/framework/zod"

/** "Kargoya ver": the items come from the order; only whether to tell the customer. */
export const AdminPostShipOrder = z.object({ notify: z.boolean().default(true) }).strict()
export type AdminPostShipOrderType = z.infer<typeof AdminPostShipOrder>
