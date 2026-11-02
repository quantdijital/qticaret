import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../../lib/content"
import { CONTENT_KINDS, CONTENT_STATUSES } from "../../../modules/content/models/content-entry"
import { MAX_POST_TAGS } from "../../../workflows/content/term-rules"

// A term's id; whether it is a category or a tag of the shop's is the workflow's check
const TERM_ID = z.string().regex(/^cterm_[0-9A-Za-z]{1,64}$/)

/**
 * `?kind=post&status=draft&q=&term_id=&offset=&limit=`: entries by title,
 * newest change first; `term_id` keeps a category's or tag's posts.
 */
export const AdminGetContent = z
  .object({
    kind: z.enum(CONTENT_KINDS).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    term_id: TERM_ID.optional(),
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export type AdminGetContentType = z.infer<typeof AdminGetContent>

// Shape and size only; the text, handle, images and cards are checked in the workflow
const fields = {
  title: z.string().max(1000),
  handle: z.string().max(200).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  body: contentDoc.optional(),
  excerpt: z.string().max(5000).nullable().optional(),
  author_name: z.string().max(1000).nullable().optional(),
  // An upload's address (checked against the media library in the workflow); "" takes it off
  image_url: z
    .string()
    .trim()
    .max(2048)
    .regex(/^(?:https?:\/\/\S+)?$/i)
    .nullable()
    .optional(),
  image_alt: z.string().max(2000).nullable().optional(),
  // A post's category (null: none) and tags ([]: none); left out, they stay (adr/0019 ek 2026-11-03)
  category_id: TERM_ID.nullable().optional(),
  tag_ids: z.array(TERM_ID).max(MAX_POST_TAGS).optional(),
}

export const AdminPostContent = z.object({ kind: z.enum(CONTENT_KINDS), ...fields }).strict()
export type AdminPostContentType = z.infer<typeof AdminPostContent>

export const AdminUpdateContent = z.object({ ...fields, title: fields.title.optional() }).strict()
export type AdminUpdateContentType = z.infer<typeof AdminUpdateContent>
