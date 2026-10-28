import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SuppressionsCard } from "@/features/settings/components/suppressions-card"

const N = "settings.notifications"

/**
 * Settings > Notifications (F9, adr/0036): how the shop's messages reach
 * its customers and staff. The SMS account has its own section (Settings
 * > SMS); here, the addresses no message goes to.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${N}.title`)} description={t(`${N}.description`)} />
      <SuppressionsCard />
    </div>
  )
}
