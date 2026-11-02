import { z } from "@medusajs/framework/zod"
import { normalizeRecipient } from "../../../../../../../lib/messaging/recipients"
import {
  GIFT_MESSAGE_MAX,
  GIFT_NAME_MAX,
  giftTextProblem,
  plainGiftText,
} from "../../../../../../../lib/promotions/gift-sale"

// Read as one plain line, then held to the e-mail's rules; empty reads as none
const giftText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform(plainGiftText)
    .refine((text) => text.length <= max, { message: "gift_card.text_too_long" })
    .refine((text) => giftTextProblem(text) !== "gift_card.text_invalid", {
      message: "gift_card.text_invalid",
    })
    .refine((text) => giftTextProblem(text) !== "gift_card.text_link", {
      message: "gift_card.text_link",
    })
    .transform((text) => (text === "" ? null : text))

/**
 * A gift line's recipient (adr/0025 Ek 2026-11-03): where the card goes
 * and, as plain text the shop's e-mail repeats, their name, the buyer's
 * words and name. Nothing that reads as a link or an address: the e-mail
 * goes to a stranger in the shop's name.
 */
export const StorePostGiftRecipient = z
  .object({
    recipient_email: z
      .string()
      .max(254)
      .transform((value, ctx) => {
        const email = normalizeRecipient("email", value)
        if (!email) {
          ctx.addIssue({ code: "custom", message: "gift_card.recipient_email_invalid" })
          return z.NEVER
        }
        return email
      }),
    recipient_name: giftText(GIFT_NAME_MAX).nullish(),
    message: giftText(GIFT_MESSAGE_MAX).nullish(),
    sender_name: giftText(GIFT_NAME_MAX).nullish(),
  })
  .strict()

export type StorePostGiftRecipientType = z.infer<typeof StorePostGiftRecipient>
