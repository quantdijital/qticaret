import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Repeat, ShoppingBag, UserPlus, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { TrendChart } from "@qticaret/admin-ui/charts/trend-chart"
import {
  formatBucket,
  formatCount,
  formatMoney,
  formatPercent,
} from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customersReportQuery } from "@/features/reports/api/customers"
import type { CustomersReport } from "@/features/reports/api/customers"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReportRange } from "@/features/reports/use-report"
import { errorText } from "@/lib/errors"

const C = "reports.customers"

type TopRow = CustomersReport["top"][number]

function useTiles(report: CustomersReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const { new_customers: joined } = report
  return [
    {
      key: "new",
      icon: UserPlus,
      label: t(`${C}.tiles.new`),
      value: formatCount(joined.current),
      hint: t(`${C}.tiles.newHint`, {
        registered: formatCount(joined.registered),
        guest: formatCount(joined.guest),
      }),
    },
    {
      key: "buyers",
      icon: ShoppingBag,
      label: t(`${C}.tiles.buyers`),
      value: formatCount(report.buyers),
      hint: t(`${C}.tiles.buyersHint`),
    },
    {
      key: "returning",
      icon: Repeat,
      label: t(`${C}.tiles.returning`),
      value: formatPercent(report.returning_rate),
      hint: t(`${C}.tiles.returningHint`, { count: report.returning }),
    },
    {
      key: "spent",
      icon: Wallet,
      label: t(`${C}.tiles.spent`),
      value: formatMoney(report.spent_per_buyer, report.currency_code),
      hint: t(`${C}.tiles.spentHint`),
    },
  ]
}

function NewCustomersChart({ report }: { report: CustomersReport }) {
  const { t } = useTranslation()
  const { current, previous } = report.new_customers
  if (current === 0 && previous === 0) {
    return (
      <p className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        {t(`${C}.chartEmpty`)}
      </p>
    )
  }
  return (
    <TrendChart
      data={report.series.map((row) => ({
        label: formatBucket(row.bucket, report.period.granularity),
        current: row.current,
        previous: row.previous,
      }))}
      currentLabel={t(`${C}.current`)}
      previousLabel={t(`${C}.previous`)}
      formatValue={formatCount}
      formatTick={formatCount}
      tableCaption={t(`${C}.chartTable`)}
    />
  )
}

function useTopColumns(currency: string): Column<TopRow>[] {
  const { t } = useTranslation()
  return [
    {
      key: "customer",
      header: t(`${C}.columns.customer`),
      cell: (row) => (
        <Link
          to="/customers/$id"
          params={{ id: row.customer_id }}
          className="font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {row.name ?? t("orders.noName")}
        </Link>
      ),
    },
    {
      key: "orders",
      header: t(`${C}.columns.orders`),
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatCount(row.orders)}</span>,
    },
    {
      key: "spent",
      header: t(`${C}.columns.spent`),
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatMoney(row.spent, currency)}</span>,
    },
  ]
}

/**
 * Customers (R1, WooCommerce's Customers report): how many joined against
 * the period before, members and guests; how many bought and what share of
 * them had bought before; the ten who spent most, each linked to their page.
 */
export function CustomerReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const report = useQuery(customersReportQuery(useReportRange()))
  const tiles = useTiles(report.data)
  const columns = useTopColumns(report.data?.currency_code ?? "try")
  if (report.isError) {
    return <ErrorState text={errorText(t, report.error)} onRetry={() => void report.refetch()} />
  }
  return (
    <>
      <ReportTiles label={t(`${C}.tiles.label`)} tiles={tiles} />
      <SectionCard title={t(`${C}.chartTitle`)} description={t(`${C}.chartHint`)}>
        {report.data ? (
          <NewCustomersChart report={report.data} />
        ) : (
          <Skeleton className="h-72 w-full" />
        )}
      </SectionCard>
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <header className="flex flex-col gap-1 px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold">{t(`${C}.topTitle`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`${C}.topHint`)}</p>
        </header>
        <DataTable
          columns={columns}
          rows={report.data?.top}
          rowKey={(row) => row.customer_id}
          loading={report.isPending}
          stale={report.isPlaceholderData}
          onRowClick={(row) => {
            void navigate({ to: "/customers/$id", params: { id: row.customer_id } })
          }}
          empty={<p className="text-sm text-muted-foreground">{t(`${C}.topEmpty`)}</p>}
        />
      </section>
      {report.data?.capped ? (
        <p className="text-xs text-muted-foreground">{t(`${C}.capped`)}</p>
      ) : null}
    </>
  )
}
