import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { overviewQuery } from "@/features/dashboard/api/overview"
import { CatalogHealthCard } from "@/features/dashboard/components/catalog-health-card"
import { CategorySalesCard } from "@/features/dashboard/components/category-sales-card"
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header"
import { KpiRow } from "@/features/dashboard/components/kpi-row"
import { OrderStatusCard } from "@/features/dashboard/components/order-status-card"
import { RecentOrdersCard } from "@/features/dashboard/components/recent-orders-card"
import { SalesChartCard } from "@/features/dashboard/components/sales-chart-card"
import { SetupBanner } from "@/features/dashboard/components/setup-banner"
import { TasksCard } from "@/features/dashboard/components/tasks-card"
import { TopProductsCard } from "@/features/dashboard/components/top-products-card"
import { DEFAULT_PERIOD } from "@/features/dashboard/period"
import type { PeriodKey } from "@/features/dashboard/period"
import { formatCount } from "@/lib/format"

interface DashboardPageProps {
  period: PeriodKey
  onPeriodChange: (period: PeriodKey) => void
}

/**
 * The shop at a glance (docs/06 Dashboard): the period's numbers, the
 * sales curve, what waits, recent orders and what sells; full width, a
 * 12-column grid from wide screens down to one column on phones.
 */
export function DashboardPage({ period, onPeriodChange }: DashboardPageProps) {
  const { t } = useTranslation()
  const overview = useQuery(overviewQuery(period))
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <DashboardHeader period={period} onPeriodChange={onPeriodChange} />
      <SetupBanner />
      <KpiRow query={overview} />
      <div className="grid grid-cols-1 gap-[var(--grid-gap)] xl:grid-cols-12">
        <SalesChartCard query={overview} className="xl:col-span-8" />
        <TasksCard className="xl:col-span-4" />
        <RecentOrdersCard className="xl:col-span-8" />
        <TopProductsCard query={overview} className="xl:col-span-4" />
        <OrderStatusCard query={overview} className="lg:col-span-1 xl:col-span-4" />
        <CategorySalesCard query={overview} className="xl:col-span-4" />
        <CatalogHealthCard className="xl:col-span-4" />
      </div>
      {overview.data?.capped ? (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.capped", { count: formatCount(5000) })}
        </p>
      ) : null}
    </div>
  )
}

const route = getRouteApi("/_auth/")

/** The route's page: the period lives in the URL (`/?period=7d`), so a link keeps it. */
export function DashboardRoute() {
  const { period } = route.useSearch()
  const navigate = route.useNavigate()
  return (
    <DashboardPage
      period={period ?? DEFAULT_PERIOD}
      onPeriodChange={(next) => {
        void navigate({
          search: { period: next === DEFAULT_PERIOD ? undefined : next },
          replace: true,
        })
      }}
    />
  )
}
