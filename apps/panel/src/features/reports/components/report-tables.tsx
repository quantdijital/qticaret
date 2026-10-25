import { Link } from "@tanstack/react-router"
import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { downloadCsv } from "@/lib/csv"
import { formatBucket, formatCount, formatMoney, formatPercent } from "@/lib/format"

const average = (sales: string, orders: number) => (orders > 0 ? Number(sales) / orders : 0)

/** Day by day (hour by hour for today): orders, units, sales and the average basket. */
export function DailyTable({ report }: { report: DashboardOverview }) {
  const { t } = useTranslation()
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const rows = [...report.series].reverse()
  const exportCsv = () => {
    downloadCsv(`satislar-${report.period.key}.csv`, [
      [
        t("reports.daily.date"),
        t("reports.daily.orders"),
        t("reports.daily.units"),
        t("reports.daily.sales"),
      ],
      ...report.series.map((row) => [
        formatBucket(row.bucket, report.period.granularity),
        row.orders,
        row.units,
        Number(row.sales),
      ]),
    ])
  }
  return (
    <SectionCard
      title={t(
        report.period.granularity === "hour" ? "reports.daily.titleHourly" : "reports.daily.title"
      )}
      flush
      action={
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download />
          {t("reports.csv")}
        </Button>
      }
    >
      <div className="max-h-[28rem] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t("reports.daily.date")}</TableHead>
              <TableHead className="text-right">{t("reports.daily.orders")}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                {t("reports.daily.units")}
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("reports.daily.average")}
              </TableHead>
              <TableHead className="pr-5 text-right">{t("reports.daily.sales")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.bucket}
                className={row.orders === 0 ? "text-muted-foreground" : undefined}
              >
                <TableCell className="pl-5">
                  {formatBucket(row.bucket, report.period.granularity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.orders)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatCount(row.units)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {row.orders ? money(average(row.sales, row.orders)) : "—"}
                </TableCell>
                <TableCell className="pr-5 text-right font-medium tabular-nums">
                  {money(row.sales)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}

/** Every product sold in the period, by sales, with its share of the total. */
export function ProductTable({ report }: { report: DashboardOverview }) {
  const { t } = useTranslation()
  const total = Number(report.totals.sales.current)
  const exportCsv = () => {
    downloadCsv(`urunler-${report.period.key}.csv`, [
      [t("reports.products.product"), t("reports.products.units"), t("reports.products.sales")],
      ...report.top_products.map((product) => [
        product.title,
        product.units,
        Number(product.sales),
      ]),
    ])
  }
  return (
    <SectionCard
      title={t("reports.products.title")}
      description={t("reports.products.hint")}
      flush
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={report.top_products.length === 0}
          onClick={exportCsv}
        >
          <Download />
          {t("reports.csv")}
        </Button>
      }
    >
      {report.top_products.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t("dashboard.top.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-5">#</TableHead>
              <TableHead>{t("reports.products.product")}</TableHead>
              <TableHead className="text-right">{t("reports.products.units")}</TableHead>
              <TableHead className="hidden w-48 lg:table-cell">
                {t("reports.products.share")}
              </TableHead>
              <TableHead className="pr-5 text-right">{t("reports.products.sales")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.top_products.map((product, index) => {
              const share = total > 0 ? Number(product.sales) / total : 0
              return (
                <TableRow key={product.product_id}>
                  <TableCell className="pl-5 text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={product.thumbnail} className="size-8" />
                      <Link
                        to="/products/$id"
                        params={{ id: product.product_id }}
                        className="truncate font-medium hover:underline"
                      >
                        {product.title}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(product.units)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                        {formatPercent(share)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 text-right font-medium tabular-nums">
                    {formatMoney(product.sales, report.currency_code)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
