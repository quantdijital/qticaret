import { useTranslation } from "react-i18next"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { SmsPanel } from "@/features/settings/pages/sms-page"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { CustomerMessagesCard } from "@/features/settings/components/customer-messages-card"
import { EmailLimitCard } from "@/features/settings/components/email-limit-card"
import { SenderDomainCard } from "@/features/settings/components/sender-domain-card"
import { SmtpCard } from "@/features/settings/components/smtp-card"
import { StaffAlertsCard } from "@/features/settings/components/staff-alerts-card"
import { SuppressionsCard } from "@/features/settings/components/suppressions-card"
import { TemplatePreviewCard } from "@/features/settings/components/template-preview-card"

const N = "settings.notifications"

/**
 * Settings > Messages (F9, adr/0036), in tabs (the owner, 2026-10-31: the
 * e-mail and SMS settings on one page): the shop's own mail server, the domain e-mail goes from, the
 * day's limit and the addresses no message goes to; the SMS account, its
 * limit and İYS; the customers' messages, their words and switches
 * (adr/0036 Ek 2026-11-10); the staff's alerts and how they read.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${N}.title`)} description={t(`${N}.description`)} />
      <SettingsTabs
        label={t(`${N}.title`)}
        tabs={[
          {
            key: "email",
            label: t(`${N}.tabs.email`),
            content: (
              <>
                <SmtpCard />
                <SenderDomainCard />
                <EmailLimitCard />
                <SuppressionsCard />
              </>
            ),
          },
          { key: "sms", label: t(`${N}.tabs.sms`), content: <SmsPanel /> },
          { key: "templates", label: t(`${N}.tabs.templates`), content: <CustomerMessagesCard /> },
          {
            key: "staff",
            label: t(`${N}.tabs.staff`),
            content: (
              <>
                <StaffAlertsCard />
                <TemplatePreviewCard />
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
