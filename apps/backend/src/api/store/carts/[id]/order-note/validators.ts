import { z } from "@medusajs/framework/zod"
import { ORDER_NOTE_RAW_MAX } from "../../../../../lib/orders/customer-note"

/**
 * The shopper's order note as typed; the workflow cleans it and holds it to
 * its limit (`ORDER_NOTE_MAX`). An empty note takes the cart's off.
 */
export const StorePostCartOrderNote = z
  .object({
    note: z.string().max(ORDER_NOTE_RAW_MAX),
  })
  .strict()

export type StorePostCartOrderNoteType = z.infer<typeof StorePostCartOrderNote>
