import type { Translate } from "@qticaret/ui"

/**
 * The hints inside the fields (owner 2026-11-05: "inputlar içinde
 * placeholderlar yok"): an example or a nudge beside the visible label,
 * never in its place. Read in `text-3` on the field (AA). The selects
 * open on a disabled first line that says what to choose.
 */
export const placeholderWords = (t: Translate) => ({
  email: t("placeholder.email"),
  password: t("placeholder.password"),
  newPassword: t("placeholder.new_password"),
  firstName: t("placeholder.first_name"),
  lastName: t("placeholder.last_name"),
  fullName: t("placeholder.full_name"),
  nameExample: t("placeholder.name_example"),
  phone: t("placeholder.phone"),
  code: t("placeholder.code"),
  street: t("placeholder.street"),
  orderNumber: t("placeholder.order_number"),
  message: t("placeholder.message"),
  company: t("placeholder.company"),
  taxOffice: t("placeholder.tax_office"),
  tckn: t("placeholder.tckn"),
  vkn: t("placeholder.vkn"),
  reviewTitle: t("placeholder.review_title"),
  reviewBody: t("placeholder.review_body"),
  question: t("placeholder.question"),
  giftName: t("placeholder.gift_name"),
  giftMessage: t("placeholder.gift_message"),
  senderName: t("placeholder.sender_name"),
  province: t("placeholder.choose_province"),
  district: t("placeholder.choose_district"),
  neighborhood: t("placeholder.choose_neighborhood"),
  subject: t("placeholder.choose_subject"),
})

export type PlaceholderWords = ReturnType<typeof placeholderWords>
