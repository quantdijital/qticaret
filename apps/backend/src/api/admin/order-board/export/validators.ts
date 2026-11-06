import { z } from "@medusajs/framework/zod"
import { ORDER_FILTER_FIELDS, checkDays } from "../validators"

/**
 * `POST /admin/order-board/export`: the order list's filters as the list
 * has them (its tab, search and filters, not its page) and the file's
 * kind; the job's input too.
 */
export const AdminPostOrderExport = z
  .object({
    ...ORDER_FILTER_FIELDS,
    format: z.enum(["xlsx", "csv"]).default("xlsx"),
  })
  .strict()
  .superRefine(checkDays)
export type AdminPostOrderExportType = z.infer<typeof AdminPostOrderExport>
