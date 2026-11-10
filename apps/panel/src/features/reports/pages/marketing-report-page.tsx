import { BadgePercent, PackageX, Repeat, Undo2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { SalesReport } from "@/features/reports/api/sales"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { ShareTable } from "@/features/reports/components/share-table"
import { useReport } from "@/features/reports/use-report"
import { formatCount, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"

const M = "reports.marketing"

/** Returns, exchanges and the discount given: what the period's sales cost back. */
function useReturnTiles(report: SalesReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const { returns, promotions } = report.details
  const discount = promotions.reduce((sum, row) => sum + Number(row.discount), 0)
  return [
    {
      key: "returns",
      icon: Undo2,
      label: t(`${M}.tiles.returnRate`),
      value: formatPercent(returns.return_rate),
      hint: t(`${M}.tiles.ofOrders`, {
        count: returns.returned,
        orders: formatCount(returns.orders),
      }),
    },
    {
      key: "exchanges",
      icon: Repeat,
      label: t(`${M}.tiles.exchangeRate`),
      value: formatPercent(returns.exchange_rate),
      hint: t(`${M}.tiles.ofOrders`, {
        count: returns.exchanged,
        orders: formatCount(returns.orders),
      }),
    },
    {
      key: "refunded",
      icon: PackageX,
      label: t(`${M}.tiles.refunded`),
      value: formatMoney(returns.refunded, report.currency_code),
      hint: t(`${M}.tiles.refundedHint`),
    },
    {
      key: "discount",
      icon: BadgePercent,
      label: t(`${M}.tiles.discount`),
      value: formatMoney(discount, report.currency_code),
      hint: t(`${M}.tiles.discountHint`),
    },
  ]
}

/** Promotion codes and where shoppers came from (F11.2): what brought the period's sales. */
export function MarketingReportPage() {
  const { t } = useTranslation()
  const report = useReport()
  const tiles = useReturnTiles(report.data)
  const data = report.data
  return (
    <>
      <ReportTiles label={t(`${M}.tiles.label`)} tiles={tiles} />
      {data ? (
        <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
          <ShareTable
            title={t(`${M}.promotions.title`)}
            description={t(`${M}.promotions.hint`)}
            rows={data.details.promotions.map((row) => ({
              key: row.code ?? "automatic",
              name: row.code ?? t(`${M}.promotions.automatic`),
              sales: row.sales,
              orders: row.orders,
              extra: row.discount,
            }))}
            total={Number(data.totals.sales.current)}
            currency={data.currency_code}
            columns={{
              name: t(`${M}.promotions.code`),
              orders: t(`${M}.orders`),
              extra: t(`${M}.promotions.discount`),
              sales: t("reports.sales"),
            }}
            table="promotions"
            empty={t(`${M}.promotions.empty`)}
          />
          <ShareTable
            title={t(`${M}.sources.title`)}
            description={t(`${M}.sources.hint`)}
            rows={data.details.sources
              .filter((row) => row.orders > 0)
              .map((row) => ({
                key: row.source,
                name: t(`${M}.sources.names.${row.source}`),
                sales: row.sales,
                orders: row.orders,
              }))}
            total={Number(data.totals.sales.current)}
            currency={data.currency_code}
            columns={{
              name: t(`${M}.sources.source`),
              orders: t(`${M}.orders`),
              sales: t("reports.sales"),
            }}
            table="sources"
            empty={t(`${M}.sources.empty`)}
          />
        </div>
      ) : (
        <Skeleton className="h-96 rounded-lg" />
      )}
    </>
  )
}
