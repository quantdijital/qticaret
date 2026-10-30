import { useQuery } from "@tanstack/react-query"
import { Landmark, Receipt, ShieldAlert, Undo2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@/components/patterns/states"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { financeReportQuery } from "@/features/reports/api/finance"
import type { FinanceReport } from "@/features/reports/api/finance"
import { ReportExportButton } from "@/features/reports/components/report-export"
import { StatementChecksCard } from "@/features/reports/components/statement-checks-card"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReportRange } from "@/features/reports/use-report"
import { formatCount, formatDate, formatMoney } from "@/lib/format"
import { errorText } from "@/lib/errors"

const F = "reports.finance"
const OPEN = ["open", "evidence_submitted"]

const sum = (values: string[]) => values.reduce((total, value) => total + Number(value), 0)

function useFinanceTiles(report: FinanceReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const money = (amount: number) => formatMoney(amount, report.currency_code)
  const open = report.chargebacks.filter((row) => OPEN.includes(row.status))
  return [
    {
      key: "vat",
      icon: Receipt,
      label: t(`${F}.tiles.vat`),
      value: money(sum(report.vat.map((row) => row.tax))),
      hint: t(`${F}.tiles.vatHint`),
    },
    {
      key: "captured",
      icon: Landmark,
      label: t(`${F}.tiles.captured`),
      value: money(sum(report.payments.map((row) => row.captured))),
      hint: t(`${F}.tiles.capturedHint`),
    },
    {
      key: "refunded",
      icon: Undo2,
      label: t(`${F}.tiles.refunded`),
      value: money(sum(report.payments.map((row) => row.refunded))),
      hint: t(`${F}.tiles.refundedHint`),
    },
    {
      key: "disputes",
      icon: ShieldAlert,
      label: t(`${F}.tiles.disputes`),
      value: formatCount(open.length),
      hint: money(sum(open.map((row) => row.amount))),
    },
  ]
}

/** Money (F11.3): sales by VAT rate, collections by payment method, the period's disputes. */
export function FinanceReportPage() {
  const { t } = useTranslation()
  const report = useQuery(financeReportQuery(useReportRange()))
  const data = report.data
  const tiles = useFinanceTiles(data)
  if (report.isError) {
    return <ErrorState text={errorText(t, report.error)} onRetry={() => void report.refetch()} />
  }
  const money = (amount: string) => formatMoney(amount, data?.currency_code ?? "try")
  return (
    <>
      <ReportTiles label={t(`${F}.tiles.label`)} tiles={tiles} />
      {!data ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <>
          <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
            <SectionCard
              title={t(`${F}.vat.title`)}
              description={t(`${F}.vat.hint`)}
              flush
              className="h-full"
              action={<ReportExportButton report="finance" format="csv" table="vat" size="sm" />}
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">{t(`${F}.vat.rate`)}</TableHead>
                    <TableHead className="text-right">{t(`${F}.vat.base`)}</TableHead>
                    <TableHead className="text-right">{t(`${F}.vat.tax`)}</TableHead>
                    <TableHead className="hidden pr-5 text-right sm:table-cell">
                      {t(`${F}.vat.gross`)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vat.map((row) => (
                    <TableRow key={row.rate}>
                      <TableCell className="pl-5 font-medium">%{row.rate}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.base)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.tax)}</TableCell>
                      <TableCell className="hidden pr-5 text-right font-medium tabular-nums sm:table-cell">
                        {money(row.gross)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
            <SectionCard
              title={t(`${F}.payments.title`)}
              description={t(`${F}.payments.hint`)}
              flush
              className="h-full"
              action={
                <ReportExportButton report="finance" format="csv" table="payments" size="sm" />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">{t(`${F}.payments.method`)}</TableHead>
                    <TableHead className="text-right">{t(`${F}.payments.captured`)}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      {t(`${F}.payments.refunded`)}
                    </TableHead>
                    <TableHead className="pr-5 text-right">{t(`${F}.payments.net`)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((row) => (
                    <TableRow key={row.method}>
                      <TableCell className="pl-5 font-medium whitespace-normal">
                        {t(`${F}.methods.${row.method}`, { defaultValue: row.method })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(row.captured)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {money(row.refunded)}
                      </TableCell>
                      <TableCell className="pr-5 text-right font-medium tabular-nums">
                        {money(row.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </div>
          <StatementChecksCard currencyCode={data.currency_code} />
          <SectionCard
            title={t(`${F}.chargebacks.title`)}
            description={t(`${F}.chargebacks.hint`)}
            flush
            action={
              data.chargebacks.length > 0 ? (
                <ReportExportButton report="finance" format="csv" table="chargebacks" size="sm" />
              ) : null
            }
          >
            {data.chargebacks.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                {t(`${F}.chargebacks.empty`)}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">{t(`${F}.chargebacks.order`)}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t(`${F}.chargebacks.reason`)}
                    </TableHead>
                    <TableHead>{t(`${F}.chargebacks.status`)}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t(`${F}.chargebacks.due`)}
                    </TableHead>
                    <TableHead className="pr-5 text-right">
                      {t(`${F}.chargebacks.amount`)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.chargebacks.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5 font-medium tabular-nums">
                        {row.order_display_id === null ? "—" : `#${String(row.order_display_id)}`}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t(`orders.chargeback.reasons.${row.reason}`, { defaultValue: row.reason })}
                      </TableCell>
                      <TableCell>
                        {t(`orders.chargeback.status.${row.status}`, { defaultValue: row.status })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.due_at ? formatDate(row.due_at) : "—"}
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">
                        {money(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}
    </>
  )
}
