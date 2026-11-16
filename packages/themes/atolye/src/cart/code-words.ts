import type { Translate } from "@qticaret/ui"
import type { CodeWords } from "./CodeForm"

const PROMOTION_ERRORS = [
  "cart.promotion_invalid",
  "cart.payment_link_locked",
  "errors.too_many_requests",
  // A wholesaler's cart takes no code (ADR-0068 §6)
  "promotions.wholesale_no_code",
]

/** The coupon field's words, the cart page's and the checkout summary's alike. */
export const promotionWords = (t: Translate): CodeWords => ({
  label: t("cart.promotion_label"),
  placeholder: t("placeholder.promo_code"),
  apply: t("cart.promotion_apply"),
  remove: t("cart.promotion_remove"),
  applied: t("cart.promotion_applied"),
  errors: Object.fromEntries(PROMOTION_ERRORS.map((key) => [key, t(key)])),
  fallback: t("cart.promotion_invalid"),
})
