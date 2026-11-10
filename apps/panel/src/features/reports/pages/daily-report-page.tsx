import { CalendarCheck, ShoppingBag, Star, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { SalesChartCard } from "@/features/dashboard/components/sales-chart-card"
import { DailyTable } from "@/features/reports/components/daily-table"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReport } from "@/features/reports/use-report"
import { formatBucket, formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"

function useDailyTiles(report: DashboardOverview | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const unit = report.period.granularity
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const buckets = report.series.length
  const sold = report.series.filter((row) => row.orders > 0)
  const best = [...sold].sort((a, b) => Number(b.sales) - Number(a.sales))[0]
  const per = (value: number) => (buckets > 0 ? value / buckets : 0)
  return [
    {
      key: "best",
      icon: Star,
      label: t(`reports.daily.tiles.best.${unit}`),
      value: best ? formatBucket(best.bucket, unit) : "—",
      ...(best ? { hint: money(best.sales) } : {}),
    },
    {
      key: "average",
      icon: Wallet,
      label: t(`reports.daily.tiles.average.${unit}`),
      value: money(per(Number(report.totals.sales.current))),
      hint: t(`reports.daily.tiles.averageHint.${unit}`, { total: formatCount(buckets) }),
    },
    {
      key: "orders",
      icon: ShoppingBag,
      label: t(`reports.daily.tiles.orders.${unit}`),
      value: per(report.totals.orders.current).toLocaleString("tr-TR", {
        maximumFractionDigits: 1,
      }),
      hint: t(`reports.daily.tiles.averageHint.${unit}`, { total: formatCount(buckets) }),
    },
    {
      key: "active",
      icon: CalendarCheck,
      label: t(`reports.daily.tiles.active.${unit}`),
      value: formatCount(sold.length),
      hint: t(`reports.daily.tiles.activeHint.${unit}`, { total: formatCount(buckets) }),
    },
  ]
}

/** Day by day (hour by hour for today): the curve, then every day's numbers. */
export function DailyReportPage() {
  const { t } = useTranslation()
  const report = useReport()
  const tiles = useDailyTiles(report.data)
  return (
    <>
      <ReportTiles label={t("reports.daily.tiles.label")} tiles={tiles} />
      <SalesChartCard query={report} />
      {report.data ? <DailyTable report={report.data} /> : <Skeleton className="h-96 rounded-lg" />}
    </>
  )
}
