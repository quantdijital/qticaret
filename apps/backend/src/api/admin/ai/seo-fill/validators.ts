import { z } from "@medusajs/framework/zod"
import { SEO_FILL_SCOPES } from "../../../../lib/ai/bulk-seo"

const NAME = /^[a-z][a-z0-9_]{0,39}$/

/**
 * "Eksik metaları yapay zekâ ile doldur" (adr/0074 §5 madde 7): what to
 * fill, both by default, and with several services the one picked. The
 * pages are never sent: the server picks them from the advisor's findings.
 */
export const AdminPostSeoFill = z
  .object({
    scope: z.enum(SEO_FILL_SCOPES).default("both"),
    service: z.string().regex(NAME).optional(),
  })
  .strict()
export type AdminPostSeoFillType = z.infer<typeof AdminPostSeoFill>
