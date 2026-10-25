import { z } from "@medusajs/framework/zod"
import { BOARD_STAGES } from "../../../lib/dashboard"

export const ORDER_BOARD_PAGE = 20

/**
 * `?stage=&q=&offset=`: a tab of the order list, Medusa's order search
 * (number, e-mail, name, place) and the page; 20 a page.
 */
export const AdminGetOrderBoard = z
  .object({
    stage: z.enum(BOARD_STAGES).default("all"),
    q: z.string().trim().max(100).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetOrderBoardType = z.infer<typeof AdminGetOrderBoard>
