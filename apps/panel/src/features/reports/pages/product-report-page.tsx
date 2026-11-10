import { Boxes, Package, Tag, TrendingUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { ProductTable } from "@/features/reports/components/product-table"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { rankedProducts } from "@/features/reports/rank"
import { useReport } from "@/features/reports/use-report"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"

const CAP = 100

function useProductTiles(report: DashboardOverview | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const units = report.totals.units.current
  const sales = Number(report.totals.sales.current)
  const best = rankedProducts(report.top_products, "sales", "")[0]
  const kinds = report.top_products.length
  return [
    {
      key: "kinds",
      icon: Package,
      label: t("reports.products.tiles.kinds"),
      value: kinds >= CAP ? `${formatCount(CAP)}+` : formatCount(kinds),
      hint: t("reports.products.tiles.kindsHint"),
    },
    {
      key: "units",
      icon: Boxes,
      label: t("reports.products.tiles.units"),
      value: formatCount(units),
      hint: t("reports.products.tiles.unitsHint"),
    },
    {
      key: "unitPrice",
      icon: Tag,
      label: t("reports.products.tiles.unitPrice"),
      value: units > 0 ? money(sales / units) : "—",
      hint: t("reports.products.tiles.unitPriceHint"),
    },
    {
      key: "best",
      icon: TrendingUp,
      label: t("reports.products.tiles.best"),
      value: best?.title ?? "—",
      ...(best ? { hint: money(best.sales) } : {}),
    },
  ]
}

/** Product by product: what sold, how much, at what price on average. */
export function ProductReportPage() {
  const { t } = useTranslation()
  const report = useReport()
  const tiles = useProductTiles(report.data)
  return (
    <>
      <ReportTiles label={t("reports.products.tiles.label")} tiles={tiles} />
      {report.data ? (
        <ProductTable report={report.data} />
      ) : (
        <Skeleton className="h-96 rounded-lg" />
      )}
    </>
  )
}
