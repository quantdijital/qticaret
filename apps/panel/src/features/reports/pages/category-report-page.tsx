import { FolderTree, FolderX, Layers, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { CategoryTable } from "@/features/reports/components/category-table"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReport } from "@/features/reports/use-report"
import { formatCount, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"

function useCategoryTiles(report: DashboardOverview | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const total = Number(report.totals.sales.current)
  const named = report.categories.filter((row) => row.kind === "category")
  const more = report.categories.some((row) => row.kind === "other")
  const loose = Number(report.categories.find((row) => row.kind === "uncategorized")?.sales ?? 0)
  const best = named[0]
  return [
    {
      key: "count",
      icon: Layers,
      label: t("reports.categories.tiles.count"),
      value: `${formatCount(named.length)}${more ? "+" : ""}`,
      hint: t("reports.categories.tiles.countHint"),
    },
    {
      key: "best",
      icon: FolderTree,
      label: t("reports.categories.tiles.best"),
      value: best?.name ?? "—",
      ...(best ? { hint: money(best.sales) } : {}),
    },
    {
      key: "loose",
      icon: FolderX,
      label: t("reports.categories.tiles.uncategorized"),
      value: money(loose),
      hint: t("reports.categories.tiles.uncategorizedHint", {
        share: formatPercent(total > 0 ? loose / total : 0),
      }),
    },
    {
      key: "total",
      icon: Wallet,
      label: t("reports.categories.tiles.total"),
      value: money(total),
      hint: t("reports.categories.tiles.totalHint"),
    },
  ]
}

/** Category by category: where the period's sales came from. */
export function CategoryReportPage() {
  const { t } = useTranslation()
  const report = useReport()
  const tiles = useCategoryTiles(report.data)
  return (
    <>
      <ReportTiles label={t("reports.categories.tiles.label")} tiles={tiles} />
      {report.data ? (
        <CategoryTable report={report.data} />
      ) : (
        <Skeleton className="h-96 rounded-lg" />
      )}
    </>
  )
}
