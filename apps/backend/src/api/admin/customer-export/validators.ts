import { z } from "@medusajs/framework/zod"

/**
 * `POST /admin/customer-export` (CU2): the customer list's filters as the
 * list has them (its search and tab, not its page) and the file's kind;
 * the job's input too.
 */
export const AdminPostCustomerExport = z
  .object({
    q: z.string().trim().max(100).optional(),
    kind: z.enum(["all", "registered", "guest"]).default("all"),
    format: z.enum(["xlsx", "csv"]).default("xlsx"),
  })
  .strict()
export type AdminPostCustomerExportType = z.infer<typeof AdminPostCustomerExport>
