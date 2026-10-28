import { z } from "@medusajs/framework/zod"

/** The shop's domain and the name before `@` its e-mail goes from. */
export const AdminPostSenderDomain = z
  .object({
    name: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/, "messaging.domain_invalid"),
    local_part: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{1,32}$/, "messaging.local_part_invalid")
      .default("bildirim"),
  })
  .strict()
export type AdminPostSenderDomainType = z.infer<typeof AdminPostSenderDomain>
