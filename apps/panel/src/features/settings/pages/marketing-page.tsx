import { useTranslation } from "react-i18next"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { AbandonedCartCard } from "@/features/settings/components/abandoned-cart-card"
import { BulkMessageSettingsCard } from "@/features/settings/components/bulk-message-settings-card"
import { ConversionsCard } from "@/features/settings/components/conversions-card"
import { FeedRulesCard } from "@/features/settings/components/feed-rules-card"
import { GoogleMerchantCard } from "@/features/settings/components/google-merchant-card"
import { ProductFeedsCard } from "@/features/settings/components/product-feeds-card"

const M = "settings.marketing"

/**
 * Settings > Marketing (F10, adr/0038), in tabs (the owner, 2026-10-31):
 * the product feeds, what they leave out and the products sent to Google
 * Merchant Center; purchases told to Meta and GA4 from the server; the
 * abandoned cart reminder; the bulk messages' limits (adr/0050).
 */
export function MarketingPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${M}.title`)} description={t(`${M}.description`)} />
      <SettingsTabs
        label={t(`${M}.title`)}
        tabs={[
          {
            key: "feeds",
            label: t(`${M}.tabs.feeds`),
            content: (
              <>
                <ProductFeedsCard />
                <FeedRulesCard />
                <GoogleMerchantCard />
              </>
            ),
          },
          { key: "conversions", label: t(`${M}.tabs.conversions`), content: <ConversionsCard /> },
          { key: "carts", label: t(`${M}.tabs.carts`), content: <AbandonedCartCard /> },
          // adr/0050: the bulk messages' 24-hour limit and the hours texts go in
          { key: "bulk", label: t(`${M}.tabs.bulk`), content: <BulkMessageSettingsCard /> },
        ]}
      />
    </div>
  )
}
