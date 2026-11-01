import { z } from "@medusajs/framework/zod"

/**
 * `GET /store/listings/products`: the listing (`type`, `id`), the prices'
 * region and currency, and in `query` the listing's own query string as
 * on its page (`marka`, attribute keys, `fiyat`, `sirala`, `sayfa`), read
 * by the listing's rules (docs/13 §7).
 */
export const StoreGetListingProducts = z
  .object({
    // `all`: the whole catalogue (`/magaza`), its id `all`
    type: z.enum(["product_category", "product_collection", "brand", "landing", "all"]),
    id: z.string().regex(/^[\w-]{1,80}$/),
    region_id: z.string().regex(/^reg_[0-9A-Za-z]{1,40}$/),
    currency_code: z.string().regex(/^[a-z]{3}$/),
    query: z.string().max(1000).default(""),
  })
  .strict()
export type StoreGetListingProductsType = z.infer<typeof StoreGetListingProducts>
