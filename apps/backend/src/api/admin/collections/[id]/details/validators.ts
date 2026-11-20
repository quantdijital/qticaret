import { z } from "@medusajs/framework/zod"
import { listingDescriptionDoc } from "../../../../../lib/catalog/listing-description"
import { ALT_MAX } from "../../../../../lib/media"
import { isStorageUrl } from "../../../../../lib/security/https-url"
import { isCleanText } from "../../../../../lib/security/text"
import { isShopPath } from "../../../../../lib/storefront/menus"

/**
 * A collection's text, visibility and picture; a field left out keeps its
 * value. The picture is a media library image by its address (whether it
 * is one of the shop's uploads is the workflow's check); null takes it off.
 */
export const AdminPostCollectionDetails = z
  .object({
    description: z
      .string()
      .max(20_000)
      // Paragraphs: line breaks and tabs are text here
      .refine((value) => isCleanText(value.replace(/[\r\n\t]/g, " ")), {
        message: "catalog.collection_description_invalid",
      })
      .nullable()
      .optional(),
    // adr/0075: the text as a content document; the server writes its plain text
    description_doc: listingDescriptionDoc.nullable().optional(),
    is_active: z.boolean().optional(),
    image: z
      .object({
        url: z
          .string()
          .trim()
          // Our storage's address (http on a developer's machine); the workflow checks it is an upload
          .refine((value) => isCleanText(value) && (isStorageUrl(value) || isShopPath(value)), {
            message: "catalog.collection_image_unknown",
          }),
        alt: z
          .string()
          .trim()
          .max(ALT_MAX)
          .refine((value) => isCleanText(value), { message: "media.alt_invalid" })
          .nullable()
          .transform((value) => (value === "" ? null : value)),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()
  // One text per save: the plain one (an import, a script) or the document (the panel)
  .refine((body) => body.description === undefined || body.description_doc === undefined, {
    message: "catalog.description_one_of",
    path: ["description_doc"],
  })
export type AdminPostCollectionDetailsType = z.infer<typeof AdminPostCollectionDetails>
