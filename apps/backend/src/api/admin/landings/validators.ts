import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../../lib/content"
import { CONTENT_STATUSES } from "../../../modules/content/models/content-entry"
import { LANDING_FACETS } from "../../../modules/content/models/landing-page"

/** `?category_id=&status=&q=&offset=&limit=`: landing pages by title, newest change first. */
export const AdminGetLandings = z
  .object({
    category_id: z.string().max(64).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export type AdminGetLandingsType = z.infer<typeof AdminGetLandings>

// Shape and size only; the facet, text and handle are checked in the workflow
const fields = {
  title: z.string().max(1000),
  handle: z.string().max(200).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  body: contentDoc.optional(),
  reviewed: z.boolean().optional(),
}

export const AdminPostLanding = z
  .object({
    category_id: z.string().max(64),
    facet: z
      .object({
        kind: z.enum(LANDING_FACETS),
        key: z.string().max(100),
        value: z.string().max(200),
      })
      .strict(),
    ...fields,
  })
  .strict()
export type AdminPostLandingType = z.infer<typeof AdminPostLanding>

export const AdminUpdateLanding = z.object({ ...fields, title: fields.title.optional() }).strict()
export type AdminUpdateLandingType = z.infer<typeof AdminUpdateLanding>
