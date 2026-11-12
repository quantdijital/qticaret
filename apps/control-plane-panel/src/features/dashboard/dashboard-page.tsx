import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { dashboardQuery } from "@/features/dashboard/api"
import { errorText } from "@/lib/errors"
import { AttentionCard, OverdueCard, RenewalsCard } from "./components/dashboard-lists"
import { KpiStrip } from "./components/kpi-strip"

/**
 * "Gösterge" (adr/0061 C18, Ek C18): the platform at a glance. A strip of
 * headline numbers (active shops, monthly recurring revenue, overdue
 * payments, renewals, unhealthy shops), then three short lists side by
 * side, each leading to its page: the oldest overdue payments, the next
 * renewals and the shops that need attention. Every role reads it.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  const query = useQuery(dashboardQuery())
  const data = query.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.text")} />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <KpiStrip data={data} />
          <PageGrid>
            {data ? (
              <>
                <PageColumn span={4}>
                  <OverdueCard data={data} />
                </PageColumn>
                <PageColumn span={4}>
                  <RenewalsCard data={data} />
                </PageColumn>
                <PageColumn span={4}>
                  <AttentionCard data={data} />
                </PageColumn>
              </>
            ) : (
              [0, 1, 2].map((index) => (
                <PageColumn key={index} span={4}>
                  <Skeleton className="h-64 rounded-lg" />
                </PageColumn>
              ))
            )}
          </PageGrid>
        </>
      )}
    </div>
  )
}
