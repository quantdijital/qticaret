import { useTranslation } from "react-i18next"
import { SectionNav } from "@/components/patterns/section-nav"

/** Kampanyalar's two screens: codes and offers, and price lists. */
export function PromotionsNav() {
  const { t } = useTranslation()
  return (
    <SectionNav
      label={t("priceLists.sections")}
      items={[
        { to: "/promotions", label: t("priceLists.sectionPromotions") },
        { to: "/promotions/price-lists", label: t("priceLists.sectionPriceLists") },
      ]}
    />
  )
}
