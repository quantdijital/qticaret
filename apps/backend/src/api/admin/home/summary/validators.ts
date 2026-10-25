import { z } from "@medusajs/framework/zod"

/** The home summary takes no query parameters. */
export const AdminGetHomeSummary = z.object({}).strict()
