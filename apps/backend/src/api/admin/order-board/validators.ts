import { z } from "@medusajs/framework/zod"
import { BOARD_STAGES } from "../../../lib/dashboard"

export const ORDER_BOARD_PAGE = 20

/**
 * `?stage=&q=&customer_id=&offset=`: a tab of the order list, Medusa's
 * order search (number, e-mail, name, place), one customer's orders and
 * the page; 20 a page.
 */
export const AdminGetOrderBoard = z
  .object({
    stage: z.enum(BOARD_STAGES).default("all"),
    q: z.string().trim().max(100).optional(),
    // One customer's orders, for their page
    customer_id: z.string().min(1).max(64).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetOrderBoardType = z.infer<typeof AdminGetOrderBoard>
