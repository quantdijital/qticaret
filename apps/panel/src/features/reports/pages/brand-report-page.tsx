import { Award, Tag, Tags, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { SalesReport } from "@/features/reports/api/sales"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { ShareTable } from "@/features/reports/components/share-table"
import { useReport } from "@/features/reports/use-report"
import { formatCount, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"

const B = "reports.brands"

function useBrandTiles(report: SalesReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const total = Number(report.totals.sales.current)
  const named = report.details.brands.filter((row) => row.name !== null)
  const loose = Number(report.details.brands.find((row) => row.name === null)?.sales ?? 0)
  const best = named[0]
  return [
    {
      key: "count",
      icon: Tags,
      label: t(`${B}.tiles.count`),
      value: formatCount(named.length),
      hint: t(`${B}.tiles.countHint`),
    },
    {
      key: "best",
      icon: Award,
      label: t(`${B}.tiles.best`),
      value: best?.name ?? "—",
      ...(best ? { hint: money(best.sales) } : {}),
    },
    {
      key: "loose",
      icon: Tag,
      label: t(`${B}.tiles.unbranded`),
      value: money(loose),
      hint: t(`${B}.tiles.unbrandedHint`, { share: formatPercent(total > 0 ? loose / total : 0) }),
    },
    {
      key: "total",
      icon: Wallet,
      label: t(`${B}.tiles.total`),
      value: money(total),
      hint: t(`${B}.tiles.totalHint`),
    },
  ]
}

/** Brand by brand (F11.2): which makes the period's sales came from. */
export function BrandReportPage() {
  const { t } = useTranslation()
  const report = useReport()
  const tiles = useBrandTiles(report.data)
  return (
    <>
      <ReportTiles label={t(`${B}.tiles.label`)} tiles={tiles} />
      {report.data ? (
        <ShareTable
          title={t(`${B}.title`)}
          description={t(`${B}.hint`)}
          rows={report.data.details.brands.map((row) => ({
            key: row.key,
            name: row.name ?? t(`${B}.unbranded`),
            sales: row.sales,
          }))}
          total={Number(report.data.totals.sales.current)}
          currency={report.data.currency_code}
          columns={{ name: t(`${B}.brand`), sales: t("reports.sales") }}
          table="brands"
          empty={t(`${B}.empty`)}
        />
      ) : (
        <Skeleton className="h-96 rounded-lg" />
      )}
    </>
  )
}
