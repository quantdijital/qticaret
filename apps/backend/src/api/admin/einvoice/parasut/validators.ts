import { z } from "@medusajs/framework/zod"

/** The owner's Paraşüt company and the code Paraşüt's page showed them (adr/0034 §5). */
export const AdminPostParasutConnection = z
  .object({
    company_id: z
      .string()
      .trim()
      .regex(/^\d{1,20}$/, "einvoice.parasut_company_invalid"),
    // What an OAuth code may hold, nothing a path or a header could carry
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._~-]{8,512}$/, "einvoice.parasut_code_invalid"),
  })
  .strict()

export type AdminPostParasutConnectionType = z.infer<typeof AdminPostParasutConnection>
