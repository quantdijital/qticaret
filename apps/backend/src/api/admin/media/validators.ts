import { z } from "@medusajs/framework/zod"
import { ALT_MAX } from "../../../lib/media/alt"
import { isCleanText } from "../../../lib/security"

// A storage key as uploads make them (`kupa-on-01J….jpg`, `1792…-kupa.jpg`): one
// segment, no way out of the storage folder or into another one
const FILE_KEY = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

/** Files just uploaded through `/admin/uploads`, as product images. */
export const AdminPostMedia = z
  .object({ file_ids: z.array(z.string().regex(FILE_KEY, "media.file_id_invalid")).min(1).max(20) })
  .strict()
export type AdminPostMediaType = z.infer<typeof AdminPostMedia>

/** An image's alt text; empty or null clears it. */
export const AdminPostMediaAlt = z
  .object({
    alt: z
      .string()
      .trim()
      .max(ALT_MAX)
      .refine((value) => isCleanText(value), "media.alt_invalid")
      .transform((value) => value || null)
      .nullable(),
  })
  .strict()
export type AdminPostMediaAltType = z.infer<typeof AdminPostMediaAlt>
