import { z } from "@medusajs/framework/zod"
import { CONTENT_TERM_KINDS } from "../../../../modules/content/models/content-term"

/** `?kind=tag&q=&offset=&limit=`: a blog's categories or tags in the shop's order (a blog has hundreds). */
export const AdminGetContentTerms = z
  .object({
    kind: z.enum(CONTENT_TERM_KINDS).optional(),
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict()
export type AdminGetContentTermsType = z.infer<typeof AdminGetContentTerms>

// Shape and size only; the name, handle and description are checked in the workflow
const fields = {
  name: z.string().max(1000),
  handle: z.string().max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  rank: z.number().int().min(0).max(100_000).optional(),
}

export const AdminPostContentTerm = z
  .object({ kind: z.enum(CONTENT_TERM_KINDS), ...fields })
  .strict()
export type AdminPostContentTermType = z.infer<typeof AdminPostContentTerm>

/** A term's kind stays as made: a category's posts are not a tag's. */
export const AdminUpdateContentTerm = z.object({ ...fields, name: fields.name.optional() }).strict()
export type AdminUpdateContentTermType = z.infer<typeof AdminUpdateContentTerm>
