import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { AbandonedCartCard } from "@/features/settings/components/abandoned-cart-card"

const M = "settings.marketing"

/**
 * Settings > Marketing (F10, adr/0038): what the shop sends and shares to
 * sell more. First the abandoned cart reminder; product feeds and
 * conversion tracking join it in their own tasks.
 */
export function MarketingPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${M}.title`)} description={t(`${M}.description`)} />
      <AbandonedCartCard />
    </div>
  )
}
