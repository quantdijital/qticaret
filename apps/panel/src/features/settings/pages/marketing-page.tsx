import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { AbandonedCartCard } from "@/features/settings/components/abandoned-cart-card"
import { ConversionsCard } from "@/features/settings/components/conversions-card"
import { GoogleMerchantCard } from "@/features/settings/components/google-merchant-card"
import { ProductFeedsCard } from "@/features/settings/components/product-feeds-card"

const M = "settings.marketing"

/**
 * Settings > Marketing (F10, adr/0038): what the shop sends and shares to
 * sell more and to measure it: the abandoned cart reminder, the product
 * feeds, the products sent to Google Merchant Center, and purchases told
 * to Meta and GA4 from the server.
 */
export function MarketingPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${M}.title`)} description={t(`${M}.description`)} />
      <AbandonedCartCard />
      <ProductFeedsCard />
      <GoogleMerchantCard />
      <ConversionsCard />
    </div>
  )
}
