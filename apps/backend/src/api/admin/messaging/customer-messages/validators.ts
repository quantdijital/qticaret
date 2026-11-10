import { z } from "@medusajs/framework/zod"

// The field checks (length, characters, tokens) are the workflow's, with each field named
const text = z.string().max(5000).nullable().optional()

/** A customer message's words and switch (adr/0036 Ek 2026-11-10); a field left out keeps its value. */
export const AdminPostTemplateTexts = z
  .object({
    enabled: z.boolean().optional(),
    subject: text,
    preheader: text,
    heading: text,
    intro: text,
    sms: text,
  })
  .strict()

export type AdminPostTemplateTextsType = z.infer<typeof AdminPostTemplateTexts>
