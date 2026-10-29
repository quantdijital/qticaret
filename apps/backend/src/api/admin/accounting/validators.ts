import { z } from "@medusajs/framework/zod"

/** A retry takes no body: anything sent is refused. */
export const AdminPostAccountingRetry = z.object({}).strict()
