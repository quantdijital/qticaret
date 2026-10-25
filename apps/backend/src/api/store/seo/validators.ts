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
