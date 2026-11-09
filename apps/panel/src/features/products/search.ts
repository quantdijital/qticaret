import { z } from "zod"

export const STOCK_FILTERS = ["in", "low", "out"] as const
export const MISSING_FILTERS = ["image", "price", "description", "seo"] as const
export const KIND_FILTERS = ["physical", "digital", "service"] as const
/** The list's orders; the first is the default. */
export const PRODUCT_SORTS = [
  "updated",
  "newest",
  "oldest",
  "title",
  "title_desc",
  "price",
  "price_desc",
  "stock",
  "stock_desc",
] as const

export type StockFilter = (typeof STOCK_FILTERS)[number]
export type MissingFilter = (typeof MISSING_FILTERS)[number]
export type KindFilter = (typeof KIND_FILTERS)[number]
export type ProductSort = (typeof PRODUCT_SORTS)[number]

// A Medusa record id (`pcat_01…`, `brand_01…`)
const recordId = z.string().regex(/^[a-z]+_[0-9A-Za-z]{1,40}$/)

/**
 * The product list's URL: `/products?status=draft&q=kupa&page=2` (1-based
 * in the URL) and its filters: `category` (with the ones below it),
 * `brand`, `stock`, `missing` (the "eksik" quick filters), `kind` and the
 * order (`sort`). A value that does not read is dropped, not refused.
 */
export const productListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["all", "published", "draft"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  category: recordId.optional().catch(undefined),
  brand: recordId.optional().catch(undefined),
  stock: z.enum(STOCK_FILTERS).optional().catch(undefined),
  missing: z.enum(MISSING_FILTERS).optional().catch(undefined),
  kind: z.enum(KIND_FILTERS).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).optional().catch(undefined),
})

export type ProductListSearch = z.infer<typeof productListSearchSchema>
