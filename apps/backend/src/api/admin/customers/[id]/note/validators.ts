import { z } from "@medusajs/framework/zod"
import { ORDER_NOTE_MAX } from "../../../../../modules/order-notes/service"

/** The customer's note; empty removes it. */
export const AdminPostCustomerNote = z
  .object({
    body: z.string().trim().max(ORDER_NOTE_MAX, "customers.note_too_long"),
  })
  .strict()
export type AdminPostCustomerNoteType = z.infer<typeof AdminPostCustomerNote>
