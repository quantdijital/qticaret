import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { ReportExportButton } from "@/features/reports/components/report-export"
import { formatBucket, formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"

const average = (sales: string, orders: number) => (orders > 0 ? Number(sales) / orders : 0)

/** Day by day (hour by hour for today): orders, units, sales and the average basket. */
export function DailyTable({ report }: { report: DashboardOverview }) {
  const { t } = useTranslation()
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  const rows = [...report.series].reverse()
  return (
    <SectionCard
      title={t(
        report.period.granularity === "hour" ? "reports.daily.titleHourly" : "reports.daily.title"
      )}
      flush
      action={<ReportExportButton format="csv" table="daily" size="sm" />}
    >
      <Table>
        <TableHeader>
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
    </SectionCard>
  )
}
