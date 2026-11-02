import { z } from "@medusajs/framework/zod"
import { MAX_QUERY_LENGTH, queryWords } from "../../../lib/search"
import { isCleanText } from "../../../lib/security/text"

/**
 * `GET /store/listings/products`: the listing (`type`, `id`), the prices'
 * region and currency, and in `query` the listing's own query string as
 * on its page (`marka`, attribute keys, `fiyat`, `sirala`, `sayfa`), read
 * by the listing's rules (docs/13 §7). A site search (`type=search`) names
 * no `id`: its `q` is what the shopper typed.
 */
export const StoreGetListingProducts = z
  .object({
    // `all`: the whole catalogue (`/magaza`), its id `all`; `sale`: what is on sale now
    // (`/kampanyalar`), its id `sale`; `search`: the catalogue weighed against `q` (`/arama`)
    type: z.enum([
      "product_category",
      "product_collection",
      "brand",
      "landing",
      "all",
      "sale",
      "search",
    ]),
    id: z
      .string()
      .regex(/^[\w-]{1,80}$/)
      .optional(),
    q: z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUERY_LENGTH)
      .refine((text) => isCleanText(text), { message: "listing.search_query_invalid" })
      .optional(),
    region_id: z.string().regex(/^reg_[0-9A-Za-z]{1,40}$/),
    currency_code: z.string().regex(/^[a-z]{3}$/),
    query: z.string().max(1000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "search") {
      // Punctuation alone is no search either
      if (value.q === undefined || queryWords(value.q).length === 0) {
        ctx.addIssue({ code: "custom", path: ["q"], message: "listing.search_query_invalid" })
      }
      return
    }
    if (value.id === undefined) {
      ctx.addIssue({ code: "custom", path: ["id"], message: "listing.id_required" })
    }
    if (value.q !== undefined) {
      ctx.addIssue({ code: "custom", path: ["q"], message: "listing.search_query_unexpected" })
    }
  })
export type StoreGetListingProductsType = z.infer<typeof StoreGetListingProducts>
