import { z } from "@medusajs/framework/zod"
import { listingDescriptionDoc } from "../../../lib/catalog/listing-description"

/**
 * A category's text as a content document (adr/0075): the panel's editor
 * sends the whole document; one without text clears the text, null drops
 * the document and keeps the plain text. The server writes the plain text.
 */
export const AdminPostCategoryDescription = z
  .object({ description_doc: listingDescriptionDoc.nullable() })
  .strict()
export type AdminPostCategoryDescriptionType = z.infer<typeof AdminPostCategoryDescription>
