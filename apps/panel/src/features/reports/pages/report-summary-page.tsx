import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageGrid } from "@/components/patterns/page-grid"
import { spanOf } from "@/components/patterns/page-spans"
import { Button } from "@/components/ui/button"
import { CategorySalesCard } from "@/features/dashboard/components/category-sales-card"
import { KpiRow } from "@/features/dashboard/components/kpi-row"
import { OrderStatusCard } from "@/features/dashboard/components/order-status-card"
import { SalesChartCard } from "@/features/dashboard/components/sales-chart-card"
import { TopProductsCard } from "@/features/dashboard/components/top-products-card"
import { useReport } from "@/features/reports/use-report"

const SUMMARY_ROWS = 5

/** To a full report, with the period kept. */
function ViewAll({
  to,
  label,
}: {
  to: "/reports/products" | "/reports/categories"
  label: string
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
      <Link to={to} search={true}>
        {label}
        <ArrowRight />
      </Link>
    </Button>
  )
}

/** The period at a glance: its numbers, its days, where its orders are, its best sellers. */
export function ReportSummaryPage() {
  const { t } = useTranslation()
  const report = useReport()
  return (
    <>
      <KpiRow query={report} />
      <PageGrid>
        <SalesChartCard query={report} className={spanOf(8)} />
        <OrderStatusCard query={report} className={spanOf(4)} />
        <TopProductsCard
          query={report}
          limit={SUMMARY_ROWS}
          action={<ViewAll to="/reports/products" label={t("reports.viewProducts")} />}
          className={spanOf(6)}
        />
        <CategorySalesCard
          query={report}
          limit={SUMMARY_ROWS}
          action={<ViewAll to="/reports/categories" label={t("reports.viewCategories")} />}
          className={spanOf(6)}
        />
      </PageGrid>
    </>
  )
}
