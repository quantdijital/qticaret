import { z } from "@medusajs/framework/zod"

export const AdminGetInvoices = z
  .object({
    status: z.enum(["pending", "issuing", "issued", "failed", "cancelled"]).optional(),
    provider: z.enum(["parasut", "external", "fake"]).optional(),
    order_id: z
      .string()
      .regex(/^order_[0-9A-Z]{10,40}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()

export type AdminGetInvoicesType = z.infer<typeof AdminGetInvoices>

/**
 * What an external program issued (adr/0034 §9): GİB's number (three
 * letters or digits, the year, nine digits), its ETTN, e-Fatura or
 * e-Arşiv, and when.
 */
// No e-invoice predates the platform; one dated ahead is a typo
const EARLIEST = Date.parse("2020-01-01T00:00:00Z")

export const AdminPostInvoiceIssued = z
  .object({
    number: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3}20\d{2}\d{9}$/, "einvoice.number_invalid"),
    uuid: z
      .string()
      .trim()
      .regex(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
        "einvoice.uuid_invalid"
      )
      .nullish(),
    document_type: z.enum(["e_invoice", "e_archive"]),
    issued_at: z.iso
      .datetime({ offset: true })
      .transform((text) => new Date(text))
      .refine(
        (at) => at.getTime() >= EARLIEST && at.getTime() <= Date.now() + 86_400_000,
        "einvoice.issued_at_invalid"
      ),
  })
  .strict()
  // GİB numbers by the year: an invoice's number names the year it was issued in
  .refine(
    (body) =>
      body.number.slice(3, 7) ===
      String(new Date(body.issued_at.getTime() + 3 * 3_600_000).getUTCFullYear()),
    { message: "einvoice.number_year", path: ["number"] }
  )

export type AdminPostInvoiceIssuedType = z.infer<typeof AdminPostInvoiceIssued>
