import { z } from "@medusajs/framework/zod"
import { ALT_MAX } from "../../../lib/media"
import { isStorageUrl } from "../../../lib/security/https-url"
import { isCleanText } from "../../../lib/security/text"
import { isShopPath } from "../../../lib/storefront/menus"

/**
 * A category's picture (adr/0046 Ek 2026-11-04): an image of the media
 * library by its address, and its alt text; null takes it off. Whether
 * the address is one of the shop's uploads is the workflow's check.
 */
export const AdminPostCategoryImage = z
  .object({
    image: z
      .object({
        url: z
          .string()
          .trim()
          // Our storage's address (http on a developer's machine); the workflow checks it is an upload
          .refine((value) => isCleanText(value) && (isStorageUrl(value) || isShopPath(value)), {
            message: "catalog.category_image_unknown",
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
      .nullable(),
  })
  .strict()
export type AdminPostCategoryImageType = z.infer<typeof AdminPostCategoryImage>
