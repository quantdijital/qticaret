import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../../lib/content"
import { isCleanText } from "../../../lib/security/text"
import { DRAFT_RESET_SOURCES } from "../../../workflows/legal/documents"

const title = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((text) => isCleanText(text), { message: "legal.title_invalid" })

export const AdminPostLegalDraft = z.object({ title, body: contentDoc }).strict()
export type AdminPostLegalDraftType = z.infer<typeof AdminPostLegalDraft>

export const AdminPostLegalPreview = z.object({ body: contentDoc }).strict()
export type AdminPostLegalPreviewType = z.infer<typeof AdminPostLegalPreview>

export const AdminPostLegalPublish = z.object({}).strict()

/** Starting the draft again: from the platform's starter, or a copy of the published text. */
export const AdminPostLegalDraftReset = z.object({ source: z.enum(DRAFT_RESET_SOURCES) }).strict()
export type AdminPostLegalDraftResetType = z.infer<typeof AdminPostLegalDraftReset>
