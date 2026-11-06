import { z } from "@medusajs/framework/zod"

/** `?q=&offset=&limit=`: a blog's authors by name. */
export const AdminGetContentAuthors = z
  .object({
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict()
export type AdminGetContentAuthorsType = z.infer<typeof AdminGetContentAuthors>

const text = (max: number) => z.string().max(max).nullable().optional()

// Shape and size only; the text, links, photo and staff account are checked in the workflow
const fields = {
  name: z.string().max(1000),
  handle: z.string().max(200).optional(),
  job_title: text(1000),
  bio: text(10_000),
  // An upload's address (checked against the media library in the workflow); "" takes it off
  image_url: z
    .string()
    .trim()
    .max(2048)
    .regex(/^(?:https?:\/\/\S+)?$/i)
    .nullable()
    .optional(),
  website_url: text(4096),
  linkedin_url: text(4096),
  instagram_url: text(4096),
  x_url: text(4096),
  user_id: z
    .string()
    .regex(/^user_[0-9A-Za-z]{1,64}$/)
    .nullable()
    .optional(),
}

export const AdminPostContentAuthor = z.object(fields).strict()
export type AdminPostContentAuthorType = z.infer<typeof AdminPostContentAuthor>

export const AdminUpdateContentAuthor = z
  .object({ ...fields, name: fields.name.optional() })
  .strict()
export type AdminUpdateContentAuthorType = z.infer<typeof AdminUpdateContentAuthor>
