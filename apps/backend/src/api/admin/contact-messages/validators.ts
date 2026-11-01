import { z } from "@medusajs/framework/zod"

export const AdminGetContactMessages = z
  .object({
    status: z.enum(["new", "handled"]).default("new"),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export type AdminGetContactMessagesType = z.infer<typeof AdminGetContactMessages>

export const AdminPostContactMessage = z.object({ status: z.enum(["new", "handled"]) }).strict()
export type AdminPostContactMessageType = z.infer<typeof AdminPostContactMessage>
