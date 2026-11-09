import { z } from "@medusajs/framework/zod"
import {
  MISSING_FILTERS,
  PRODUCT_KIND_FILTERS,
  PRODUCT_ORDERS,
  PRODUCT_STATUSES,
  STOCK_FILTERS,
} from "../../../lib/catalog/product-board"

/** A page; "select all" asks up to the bulk edit's limit at once. */
export const PRODUCT_BOARD_PAGE = 20
export const PRODUCT_BOARD_MAX = 1000

const id = z.string().trim().min(1).max(64)

/**
 * `?q=&status=&category_id=&brand_id=&type_id=&kind=&stock=&missing=&order=&offset=&limit=`:
 * Medusa's product search (name, address, SKU), the state, a category and
 * the ones below it, a brand, a product type, the kind, where the stock
 * stands, what it lacks ("eksik"), the order and the page.
 */
export const AdminGetProductBoard = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    category_id: id.optional(),
    brand_id: id.optional(),
    type_id: id.optional(),
    kind: z.enum(PRODUCT_KIND_FILTERS).optional(),
    stock: z.enum(STOCK_FILTERS).optional(),
    missing: z.enum(MISSING_FILTERS).optional(),
    order: z.enum(PRODUCT_ORDERS).default("-updated_at"),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(PRODUCT_BOARD_MAX).default(PRODUCT_BOARD_PAGE),
  })
  .strict()
export type AdminGetProductBoardType = z.infer<typeof AdminGetProductBoard>
