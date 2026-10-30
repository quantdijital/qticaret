import { z } from "zod"
import { INVOICE_STATUSES } from "@/features/orders/api/invoices"

/** The invoice list's URL: `/orders/invoices?view=issued&page=2` (1-based in the URL). */
export const invoiceSearchSchema = z.object({
  view: z
    .enum([...INVOICE_STATUSES, "all"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
