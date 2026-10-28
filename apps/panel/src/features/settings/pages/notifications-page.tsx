import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SenderDomainCard } from "@/features/settings/components/sender-domain-card"
import { StaffAlertsCard } from "@/features/settings/components/staff-alerts-card"
import { SuppressionsCard } from "@/features/settings/components/suppressions-card"

const N = "settings.notifications"

/**
 * Settings > Notifications (F9, adr/0036): how the shop's messages reach
 * its customers and staff. The SMS account has its own section (Settings
 * > SMS); here, the staff's alerts, the domain e-mail goes from and the
 * addresses no message goes to.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${N}.title`)} description={t(`${N}.description`)} />
      <StaffAlertsCard />
      <SenderDomainCard />
      <SuppressionsCard />
    </div>
  )
}
