import { z } from "@medusajs/framework/zod"
import { SLUG_SEGMENT } from "../../../lib/seo"
import { CONTENT_KINDS } from "../../../modules/content/models/content-entry"
import { CONTENT_TERM_KINDS } from "../../../modules/content/models/content-term"

const HANDLE = z
  .string()
  .max(200)
  .regex(new RegExp(`^${SLUG_SEGMENT}$`))

/**
 * `?kind=post&category=&tag=&offset=&limit=`: live entries, the newest
 * first (the blog's list); `category` and `tag` (handles) keep the posts
 * filed under them (adr/0019 ek 2026-11-03).
 */
export const StoreGetContent = z
  .object({
    kind: z.enum(CONTENT_KINDS).optional(),
    category: HANDLE.optional(),
    tag: HANDLE.optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict()
export type StoreGetContentType = z.infer<typeof StoreGetContent>

/** `?kind=category`: the blog's categories or tags that have live posts, with how many. */
export const StoreGetContentTerms = z
  .object({ kind: z.enum(CONTENT_TERM_KINDS).optional() })
  .strict()
export type StoreGetContentTermsType = z.infer<typeof StoreGetContentTerms>
