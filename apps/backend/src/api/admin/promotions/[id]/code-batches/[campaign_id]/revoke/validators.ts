import { z } from "@medusajs/framework/zod"

/** Stopping a batch takes nothing but its path. */
export const AdminPostCodeBatchRevoke = z.object({}).strict()
