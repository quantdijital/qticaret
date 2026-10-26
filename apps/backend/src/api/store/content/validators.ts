import { z } from "@medusajs/framework/zod"
import { CONTENT_KINDS } from "../../../modules/content/models/content-entry"

/** `?kind=post&offset=&limit=`: live entries, the newest first (the blog's list). */
export const StoreGetContent = z
  .object({
    kind: z.enum(CONTENT_KINDS).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict()
export type StoreGetContentType = z.infer<typeof StoreGetContent>
