import type { Translate } from "@qticaret/ui"
import type { GiftWords } from "./GiftFields"

/** The backend's refusals of a gift card's recipient (adr/0025 Ek 2026-11-03), shown in words. */
export const GIFT_ERRORS = [
  "gift_card.recipient_email_invalid",
  "gift_card.text_too_long",
  "gift_card.text_invalid",
  "gift_card.text_link",
  "gift_card.sale_disabled",
  "gift_card.not_gift_line",
  "messaging.email_domain_refuses",
]

export const giftWords = (t: Translate): GiftWords => ({
  title: t("gift.title"),
  email: t("gift.recipient_email"),
  name: t("gift.recipient_name"),
  message: t("gift.message"),
  messageHint: t("gift.message_hint"),
  sender: t("gift.sender_name"),
})
