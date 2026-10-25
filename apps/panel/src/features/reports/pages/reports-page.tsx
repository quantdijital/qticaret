import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { PageHeader } from "@/components/patterns/page-header"
import { PeriodPicker } from "@/components/patterns/period-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { CategorySalesCard } from "@/features/dashboard/components/category-sales-card"
import { KpiRow } from "@/features/dashboard/components/kpi-row"
import { OrderStatusCard } from "@/features/dashboard/components/order-status-card"
import { SalesChartCard } from "@/features/dashboard/components/sales-chart-card"
import { DEFAULT_PERIOD, PERIODS } from "@/features/dashboard/period"
import { salesReportQuery } from "@/features/reports/api/sales"
import { DailyTable, ProductTable } from "@/features/reports/components/report-tables"
import { formatCount } from "@/lib/format"

const route = getRouteApi("/_auth/reports")

/**
 * Reports (docs/06 §4): the period's sales in depth, day by day and
 * product by product, each table downloadable as CSV. No personal data.
 */
export function ReportsPage() {
  const { t } = useTranslation()
  const { period = DEFAULT_PERIOD } = route.useSearch()
  const navigate = route.useNavigate()
  const report = useQuery(salesReportQuery(period))
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("nav.reports")}
        description={t("reports.description")}
        action={
          <PeriodPicker
            periods={PERIODS}
            value={period}
            onChange={(next) => {
              void navigate({
                search: { period: next === DEFAULT_PERIOD ? undefined : next },
                replace: true,
              })
            }}
          />
        }
      />
      <KpiRow query={report} />
      <div className="grid grid-cols-1 gap-[var(--grid-gap)] xl:grid-cols-12">
        <SalesChartCard query={report} className="xl:col-span-8" />
        <OrderStatusCard query={report} className="xl:col-span-4" />
      </div>
      <AsyncBody query={report} skeleton={<Skeleton className="h-96 rounded-lg" />}>
        {(data) => (
          <div className="grid grid-cols-1 items-start gap-[var(--grid-gap)] xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ProductTable report={data} />
            </div>
            <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-5">
              <CategorySalesCard query={report} />
              <DailyTable report={data} />
            </div>
          </div>
        )}
      </AsyncBody>
      {report.data?.capped ? (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.capped", { count: formatCount(5000) })}
        </p>
      ) : null}
    </div>
  )
}
