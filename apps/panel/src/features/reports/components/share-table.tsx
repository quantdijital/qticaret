import type { ReactNode } from "react"
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
import { ReportExportButton } from "@/features/reports/components/report-export"
import type { ReportTable } from "@/features/reports/components/report-export"
import { formatCount, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

export interface ShareRow {
  key: string
  name: string
  sales: string
  /** Orders behind the row, when the table counts them. */
  orders?: number
  /** A second money column (a promotion's discount). */
  extra?: string
}

/**
 * A report's breakdown with each row's share of the period's sales (F11.2):
 * brands, promotion codes, traffic sources. Its CSV is made on the server.
 */
export function ShareTable({
  title,
  description,
  rows,
  total,
  currency,
  columns,
  table,
  empty,
  className,
}: {
  title: string
  description?: string
  rows: ShareRow[]
  total: number
  currency: string
  columns: { name: string; orders?: string; extra?: string; sales: string }
  table: ReportTable
  empty: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const shareOf = (row: ShareRow) => (total > 0 ? Number(row.sales) / total : 0)
  return (
    <SectionCard
      title={title}
      {...(description ? { description } : {})}
      flush
      className={cn("h-full", className)}
      action={rows.length > 0 ? <ReportExportButton format="csv" table={table} size="sm" /> : null}
    >
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{columns.name}</TableHead>
              {columns.orders ? (
                <TableHead className="text-right">{columns.orders}</TableHead>
              ) : null}
              {columns.extra ? (
                <TableHead className="hidden text-right sm:table-cell">{columns.extra}</TableHead>
              ) : null}
              <TableHead className="hidden text-right md:table-cell">
                {t("reports.share")}
              </TableHead>
              <TableHead className="pr-5 text-right">{columns.sales}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="pl-5 font-medium">{row.name}</TableCell>
                {columns.orders ? (
                  <TableCell className="text-right tabular-nums">
                    {formatCount(row.orders ?? 0)}
                  </TableCell>
                ) : null}
                {columns.extra ? (
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatMoney(row.extra ?? 0, currency)}
                  </TableCell>
                ) : null}
                <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums md:table-cell">
                  {formatPercent(shareOf(row))}
                </TableCell>
                <TableCell className="pr-5 text-right font-medium tabular-nums">
                  {formatMoney(row.sales, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
