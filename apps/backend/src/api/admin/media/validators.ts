import { z } from "@medusajs/framework/zod"
import { ALT_MAX, MEDIA_NAME_MAX } from "../../../lib/media"
import { isCleanText } from "../../../lib/security"

// A storage key as uploads make them (`kupa-on-01J….jpg`, `1792…-kupa.jpg`): one
// segment, no way out of the storage folder or into another one
const FILE_KEY = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

// An alt text is plain words read aloud: no markup, no address (defence in depth; it is escaped where shown)
export const ALT_MARKUP_OR_LINK = /[<>]|https?:\/\/|\bwww\./i

/**
 * `?q=&kind=image&view=&offset=&limit=`: the library's files, newest
 * first; `view` narrows to the ones nothing shows (`unused`, M1) or
 * those without an alt text (`missing_alt`).
 */
export const AdminGetMedia = z
  .object({
    q: z.string().trim().max(200).optional(),
    view: z.enum(["all", "unused", "missing_alt"]).optional(),
    // Images are all the library holds today; the kind is named for what comes later
    kind: z.enum(["image"]).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict()
export type AdminGetMediaType = z.infer<typeof AdminGetMedia>

// A media record's id (`media_01J…`)
const MEDIA_ID = /^media_[0-9A-Za-z]{1,40}$/

/** Pictures to delete at once (M1): 1–100, each once; the server keeps any in use. */
export const AdminDeleteMediaBatch = z
  .object({
    ids: z
      .array(z.string().regex(MEDIA_ID, "media.id_invalid"))
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "media.id_duplicate"),
  })
  .strict()
export type AdminDeleteMediaBatchType = z.infer<typeof AdminDeleteMediaBatch>

/** An image's detail takes no query. */
export const AdminGetMediaAsset = z.object({}).strict()

/**
 * Files just uploaded through `/admin/uploads` (checked and cleaned there),
 * as images; `library` keeps them in the library until deleted there.
 */
export const AdminPostMedia = z
  .object({
    file_ids: z.array(z.string().regex(FILE_KEY, "media.file_id_invalid")).min(1).max(20),
    library: z.boolean().optional(),
  })
  .strict()
export type AdminPostMediaType = z.infer<typeof AdminPostMedia>

/** An image's alt text (empty or null clears it) and the name the library shows. */
export const AdminUpdateMedia = z
  .object({
    alt: z
      .string()
      .trim()
      .max(ALT_MAX)
      .refine((value) => isCleanText(value), "media.alt_invalid")
      .refine((value) => !ALT_MARKUP_OR_LINK.test(value), "media.alt_markup")
      .transform((value) => value || null)
      .nullable()
      .optional(),
    filename: z
      .string()
      .trim()
      .min(1, "media.filename_invalid")
      .max(MEDIA_NAME_MAX, "media.filename_invalid")
      .refine((value) => isCleanText(value), "media.filename_invalid")
      .optional(),
  })
  .strict()
  .refine((body) => body.alt !== undefined || body.filename !== undefined, "media.update_empty")
export type AdminUpdateMediaType = z.infer<typeof AdminUpdateMedia>

/** An image's address, brought into the library. */
export const AdminImportMedia = z
  .object({ url: z.string().trim().min(1, "media.import_address_refused").max(2048) })
  .strict()
export type AdminImportMediaType = z.infer<typeof AdminImportMedia>
