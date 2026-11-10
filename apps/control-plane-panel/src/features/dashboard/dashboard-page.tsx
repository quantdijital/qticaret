import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState } from "@qticaret/admin-ui/patterns/states"

/**
 * "Gösterge": empty until the platform has shops to sum up (adr/0061 C18:
 * active shops, monthly recurring revenue, late payments, renewals,
 * unhealthy shops). One sentence says so; nothing pretends to be data.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.text")} />
      <SectionCard title={t("dashboard.summary")}>
        <EmptyState text={t("dashboard.empty")} />
      </SectionCard>
    </div>
  )
}
