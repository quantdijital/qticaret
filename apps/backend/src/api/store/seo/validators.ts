import { z } from "@medusajs/framework/zod"

/** `?path=/eski-urun?utm_source=x`: the path the visitor asked for, query included. */
export const StoreGetSeoResolve = z.object({ path: z.string().min(1).max(2048) }).strict()
export type StoreGetSeoResolveType = z.infer<typeof StoreGetSeoResolve>

/**
 * A 404 the storefront served (docs/13 §4): the path and the page that
 * linked to it. Only the referrer's host is kept.
 */
export const StorePostNotFound = z
  .object({
    path: z.string().min(1).max(2048),
    referrer: z.string().max(2048).optional(),
  })
  .strict()
export type StorePostNotFoundType = z.infer<typeof StorePostNotFound>

/**
 * `?type=product&id=prod_1&id=prod_2`: the storefront paths of up to 100
 * records of one type (adr/0046 §3), for the links on a page. A single id
 * comes as a string, several as an array.
 */
export const StoreGetSeoPaths = z
  .object({
    type: z.enum([
      "product",
      "product_category",
      "product_collection",
      "brand",
      "page",
      "post",
      "landing",
    ]),
    id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().regex(/^[a-z]+_[0-9A-Za-z]{1,64}$/))
          .min(1)
          .max(100)
      ),
  })
  .strict()
export type StoreGetSeoPathsType = z.infer<typeof StoreGetSeoPaths>
