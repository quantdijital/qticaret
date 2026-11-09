import { z } from "zod"

export const GIFT_CARD_STATES = ["active", "used", "expired"] as const
export type GiftCardState = (typeof GIFT_CARD_STATES)[number]

/**
 * The gift cards' URL: `?q=GIFT-7K&state=used&page=2` (a code or its start,
 * where the cards stand, 1-based page); `?card=gcard_…` shows that card
 * alone (an order line links it).
 */
export const giftCardSearchSchema = z.object({
  card: z
    .string()
    .regex(/^[A-Za-z0-9_]{1,64}$/)
    .optional()
    .catch(undefined),
  q: z.string().max(64).optional().catch(undefined),
  state: z.enum(GIFT_CARD_STATES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type GiftCardSearch = z.infer<typeof giftCardSearchSchema>
