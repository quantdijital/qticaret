import type { UseQueryResult } from "@tanstack/react-query"
import { Boxes, Receipt, ShoppingBag, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { DeltaBadge } from "@/components/patterns/delta-badge"
import { KpiTile } from "@/components/patterns/kpi-tile"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { formatCount, formatMoney } from "@/lib/format"

function Tiles({ overview }: { overview: DashboardOverview }) {
  const { t } = useTranslation()
  const { totals, series, currency_code: currency, period } = overview
  const money = (amount: string) => formatMoney(amount, currency)
  const hint = t(`period.compare.${period.key}`)
  const tiles = [
    {
      key: "sales",
      icon: Wallet,
      value: money(totals.sales.current),
      delta: [Number(totals.sales.current), Number(totals.sales.previous)],
      trend: series.map((row) => Number(row.sales)),
    },
    {
      key: "orders",
      icon: ShoppingBag,
      value: formatCount(totals.orders.current),
      delta: [totals.orders.current, totals.orders.previous],
      trend: series.map((row) => row.orders),
    },
    {
      key: "average",
      icon: Receipt,
      value: money(totals.average_order.current),
      delta: [Number(totals.average_order.current), Number(totals.average_order.previous)],
      trend: series.map((row) => (row.orders ? Number(row.sales) / row.orders : 0)),
    },
    {
      key: "units",
      icon: Boxes,
      value: formatCount(totals.units.current),
      delta: [totals.units.current, totals.units.previous],
      trend: series.map((row) => row.units),
    },
  ] as const
  return (
    <>
      {tiles.map((tile) => (
        <KpiTile
          key={tile.key}
          icon={tile.icon}
          label={t(`dashboard.kpi.${tile.key}`)}
          value={tile.value}
          delta={<DeltaBadge current={tile.delta[0]} previous={tile.delta[1]} />}
          hint={hint}
          trend={[...tile.trend]}
          className="bg-card"
        />
      ))}
    </>
  )
}

function TilesSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex flex-col gap-3 bg-card p-5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </>
  )
}

/**
 * The period's four headline numbers in one strip: hairline dividers come
 * from the 1px gap over the border colour, so they hold in every layout.
 */
export function KpiRow({ query }: { query: UseQueryResult<DashboardOverview> }) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t("dashboard.kpi.label")}
      className="grid gap-px overflow-hidden rounded-lg border bg-border shadow-card sm:grid-cols-2 xl:grid-cols-4"
    >
      <AsyncBody query={query} skeleton={<TilesSkeleton />} className="contents">
        {(overview) => <Tiles overview={overview} />}
      </AsyncBody>
    </section>
  )
}
