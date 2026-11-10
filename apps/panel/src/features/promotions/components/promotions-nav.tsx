import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { useFeature } from "@/features/settings/api/features"

/** Kampanyalar's screens: codes and offers, price lists, and gift cards when on. */
export function PromotionsNav() {
  const { t } = useTranslation()
  // Gift cards only once the shop has taken them on (F4.8)
  const giftCards = useFeature(GIFT_CARDS_FLAG)
  return (
    <SectionNav
      label={t("priceLists.sections")}
      items={[
        { to: "/promotions", label: t("priceLists.sectionPromotions") },
        { to: "/promotions/price-lists", label: t("priceLists.sectionPriceLists") },
        ...(giftCards ? [{ to: "/promotions/gift-cards", label: t("giftCards.section") }] : []),
      ]}
    />
  )
}
