import { z } from "@medusajs/framework/zod"
import { GIFT_CARD_STATES } from "../../../lib/promotions/gift-card-list"

export const GIFT_CARD_LIST_PAGE = 25

/** `?q=&state=&offset=`: a code or its start, active, spent or expired cards, the page. */
export const AdminGetGiftCardList = z
  .object({
    q: z.string().trim().max(64).optional(),
    state: z.enum(GIFT_CARD_STATES).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetGiftCardListType = z.infer<typeof AdminGetGiftCardList>
