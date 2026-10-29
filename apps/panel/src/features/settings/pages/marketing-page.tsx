import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { AbandonedCartCard } from "@/features/settings/components/abandoned-cart-card"
import { GoogleMerchantCard } from "@/features/settings/components/google-merchant-card"
import { ProductFeedsCard } from "@/features/settings/components/product-feeds-card"

const M = "settings.marketing"

/**
 * Settings > Marketing (F10, adr/0038): what the shop sends and shares to
 * sell more: the abandoned cart reminder, the product feeds and the
 * products sent to Google Merchant Center; conversion tracking joins them
 * in its own task.
 */
export function MarketingPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${M}.title`)} description={t(`${M}.description`)} />
      <AbandonedCartCard />
      <ProductFeedsCard />
      <GoogleMerchantCard />
    </div>
  )
}
