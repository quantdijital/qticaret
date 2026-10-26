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
import { useCategoryName } from "@/features/reports/category-name"
import { downloadCsv } from "@/lib/csv"
import { formatMoney, formatPercent } from "@/lib/format"

type Category = DashboardOverview["categories"][number]

/** The period's sales category by category, with each one's share. */
export function CategoryTable({ report }: { report: DashboardOverview }) {
  const { t } = useTranslation()
  const nameOf = useCategoryName()
  const total = Number(report.totals.sales.current)
  const shareOf = (row: Category) => (total > 0 ? Number(row.sales) / total : 0)
  const exportCsv = () => {
    downloadCsv(`kategoriler-${report.period.key}.csv`, [
      [
        t("reports.categories.category"),
        t("reports.categories.share"),
        t("reports.categories.sales"),
      ],
      ...report.categories.map((row) => [
        nameOf(row),
        Math.round(shareOf(row) * 1000) / 10,
        Number(row.sales),
      ]),
    ])
  }
  return (
    <SectionCard
      title={t("reports.categories.title")}
      description={t("reports.categories.hint")}
      flush
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={report.categories.length === 0}
          onClick={exportCsv}
        >
          <Download />
          {t("reports.csv")}
        </Button>
      }
    >
      {report.categories.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t("dashboard.categories.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-5">#</TableHead>
              <TableHead>{t("reports.categories.category")}</TableHead>
              <TableHead className="hidden w-[40%] md:table-cell">
                {t("reports.categories.share")}
              </TableHead>
              <TableHead className="pr-5 text-right">{t("reports.categories.sales")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.categories.map((row, index) => (
              <TableRow
                key={row.key}
                className={row.kind === "category" ? undefined : "text-muted-foreground"}
              >
                <TableCell className="pl-5 text-xs text-muted-foreground tabular-nums">
                  {row.kind === "other" ? "" : index + 1}
                </TableCell>
                <TableCell className="font-medium">{nameOf(row)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-chart-1"
                        style={{ width: `${shareOf(row) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                      {formatPercent(shareOf(row))}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="pr-5 text-right font-medium tabular-nums">
                  {formatMoney(row.sales, report.currency_code)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
