import { z } from "@medusajs/framework/zod"
import { ORDER_NOTE_MAX } from "../../../../../modules/order-notes/service"

export const AdminPostOrderNote = z
  .object({
    body: z.string().trim().min(1, "orders.note_empty").max(ORDER_NOTE_MAX, "orders.note_too_long"),
    // Batch 9 / O3: "Müşteriye gönder", the note e-mailed to the order's customer too
    notify_customer: z.boolean().optional(),
  })
  .strict()
export type AdminPostOrderNoteType = z.infer<typeof AdminPostOrderNote>
