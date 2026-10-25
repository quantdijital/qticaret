import { z } from "@medusajs/framework/zod"
import { STOCK_VIEWS } from "../../../lib/dashboard"

export const STOCK_BOARD_PAGE = 25

/** `?view=&q=&offset=`: all, low or sold-out items, Medusa's item search (SKU, title), the page. */
export const AdminGetStockBoard = z
  .object({
    view: z.enum(STOCK_VIEWS).default("all"),
    q: z.string().trim().max(100).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetStockBoardType = z.infer<typeof AdminGetStockBoard>
