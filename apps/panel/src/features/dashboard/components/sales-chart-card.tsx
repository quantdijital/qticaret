import type { UseQueryResult } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { TrendChart } from "@qticaret/admin-ui/charts/trend-chart"
import { AsyncBody } from "@/components/patterns/async-body"
import { DeltaBadge } from "@qticaret/admin-ui/patterns/delta-badge"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import {
  formatBucket,
  formatCompactMoney,
  formatCount,
  formatMoney,
} from "@qticaret/admin-ui/lib/format"

type Metric = "amount" | "count"

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Chart({ overview, metric }: { overview: DashboardOverview; metric: Metric }) {
  const { t } = useTranslation()
  const { series, totals, currency_code: currency, period } = overview
  const amount = metric === "amount"
  const current = amount ? Number(totals.sales.current) : totals.orders.current
  const previous = amount ? Number(totals.sales.previous) : totals.orders.previous
  const data = series.map((row) => ({
    label: formatBucket(row.bucket, period.granularity),
    current: amount ? Number(row.sales) : row.orders,
    previous: amount ? Number(row.previous_sales) : row.previous_orders,
  }))
  const formatValue = (value: number) =>
    amount ? formatMoney(value, currency) : formatCount(value)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
              {formatValue(current)}
            </span>
            <DeltaBadge current={current} previous={previous} />
          </div>
          <span className="text-xs text-muted-foreground">{t(`period.compare.${period.key}`)}</span>
        </div>
        <div className="flex items-center gap-4">
          <LegendKey color="var(--chart-1)" label={t("dashboard.sales.current")} />
          <LegendKey color="var(--chart-muted)" label={t("dashboard.sales.previous")} />
        </div>
      </div>
      {current === 0 && previous === 0 ? (
        <p className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          {t("dashboard.sales.empty")}
        </p>
      ) : (
        <TrendChart
          data={data}
          currentLabel={t("dashboard.sales.current")}
          previousLabel={t("dashboard.sales.previous")}
          formatValue={formatValue}
          formatTick={(value) =>
            amount ? formatCompactMoney(value, currency) : formatCount(value)
          }
          tableCaption={t("dashboard.sales.table")}
        />
      )}
    </div>
  )
}

/** Sales or orders over the period against the one before (one axis, one measure at a time). */
export function SalesChartCard({
  query,
  className,
}: {
  query: UseQueryResult<DashboardOverview>
  className?: string
}) {
  const { t } = useTranslation()
  const [metric, setMetric] = useState<Metric>("amount")
  return (
    <SectionCard
      title={t("dashboard.sales.title")}
      className={className}
      action={
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={metric}
          onValueChange={(next) => {
            if (next) {
              setMetric(next as Metric)
            }
          }}
        >
          <ToggleGroupItem
            value="amount"
            className="px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            {t("dashboard.sales.amount")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="count"
            className="px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            {t("dashboard.sales.count")}
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-72 w-full" />
          </div>
        }
      >
        {(overview) => <Chart overview={overview} metric={metric} />}
      </AsyncBody>
    </SectionCard>
  )
}
