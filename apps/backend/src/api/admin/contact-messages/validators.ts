import { z } from "@medusajs/framework/zod"
import { CONTACT_SUBJECTS } from "../../../modules/contact-messages/models/contact-message"

export const AdminGetContactMessages = z
  .object({
    status: z.enum(["new", "handled"]).default("new"),
    // adr/0076 Ek 2026-11-23: one subject only (booking requests, say)
    subject: z.enum(CONTACT_SUBJECTS).optional(),
    // A person's messages by their phone, as typed (a KVKK request; adr/0076 Ek 2026-11-23)
    phone: z.string().trim().min(1).max(20).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export type AdminGetContactMessagesType = z.infer<typeof AdminGetContactMessages>

export const AdminPostContactMessage = z.object({ status: z.enum(["new", "handled"]) }).strict()
export type AdminPostContactMessageType = z.infer<typeof AdminPostContactMessage>
