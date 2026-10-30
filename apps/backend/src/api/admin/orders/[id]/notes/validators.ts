import { z } from "@medusajs/framework/zod"
import { ORDER_NOTE_MAX } from "../../../../../modules/order-notes/service"

export const AdminPostOrderNote = z
  .object({
    body: z.string().trim().min(1, "orders.note_empty").max(ORDER_NOTE_MAX, "orders.note_too_long"),
  })
  .strict()
export type AdminPostOrderNoteType = z.infer<typeof AdminPostOrderNote>
