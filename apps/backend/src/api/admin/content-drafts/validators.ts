import { z } from "@medusajs/framework/zod"
import { DRAFT_KINDS } from "../../../lib/content-drafts/prompts"

/** A draft asked for: which product, which text. */
export const AdminPostContentDraft = z
  .object({
    entity_type: z.literal("product"),
    entity_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
    kind: z.enum(DRAFT_KINDS),
  })
  .strict()
export type AdminPostContentDraftType = z.infer<typeof AdminPostContentDraft>

/** A product's drafts. */
export const AdminGetContentDrafts = z.object({
  entity_type: z.literal("product"),
  entity_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
})
export type AdminGetContentDraftsType = z.infer<typeof AdminGetContentDrafts>
