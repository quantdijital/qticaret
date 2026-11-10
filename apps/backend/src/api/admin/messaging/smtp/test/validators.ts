import { z } from "@medusajs/framework/zod"

/** "Deneme e-postası gönder" takes nothing: the stored server, the caller's own address. */
export const AdminPostSmtpTest = z.object({}).strict()
