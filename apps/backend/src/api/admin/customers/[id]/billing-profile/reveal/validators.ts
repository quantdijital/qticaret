import { z } from "@medusajs/framework/zod"

// Nothing to send: who asks and which customer are in the session and the path
export const AdminPostRevealTaxId = z.object({}).strict()
