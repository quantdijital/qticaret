import { z } from "zod"

/** The gift cards' URL: `/promotions/gift-cards?card=gcard_…` shows that card alone (an order line links it). */
export const giftCardSearchSchema = z.object({
  card: z
    .string()
    .regex(/^[A-Za-z0-9_]{1,64}$/)
    .optional()
    .catch(undefined),
})
