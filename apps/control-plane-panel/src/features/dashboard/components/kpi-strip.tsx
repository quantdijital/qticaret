import { Activity, CalendarClock, CircleAlert, Store, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { KpiTile } from "@qticaret/admin-ui/patterns/kpi-tile"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { money } from "@/features/billing/words"
import type { Dashboard } from "@/features/dashboard/api"

// Five tiles: on two columns the fifth takes the row, so no cell is left empty
const STRIP =
  "grid gap-px overflow-hidden rounded-lg border bg-border shadow-card sm:grid-cols-2 xl:grid-cols-5 sm:[&>:last-child]:col-span-2 xl:[&>:last-child]:col-span-1"

/**
 * The platform's headline numbers (adr/0061 C18): active shops, monthly
 * recurring revenue, overdue payments, the next 30 days' renewals and
 * unhealthy shops, one strip; hairline dividers from the 1px gap over the
 * border colour, every tile as tall as the tallest.
 */
export function KpiStrip({ data }: { data: Dashboard | undefined }) {
  const { t } = useTranslation()
  if (!data) {
    return (
      <section aria-label={t("dashboard.tiles.label")} aria-busy="true" className={STRIP}>
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex flex-col gap-3 bg-card p-5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </section>
    )
  }
  const { shops, revenue, overdue, renewals, health } = data
  const tiles = [
    {
      key: "active",
      icon: Store,
      value: formatCount(shops.active),
      hint: t("dashboard.tiles.activeHint", {
        total: formatCount(shops.total),
        restricted: formatCount(shops.restricted),
        suspended: formatCount(shops.suspended),
      }),
    },
    {
      key: "mrr",
      icon: Wallet,
      value: money(revenue.mrr, revenue.currency_code),
      hint: t("dashboard.tiles.mrrHint", {
        count: revenue.paying_count,
        trial: formatCount(revenue.trial.count),
        amount: money(revenue.trial.mrr, revenue.currency_code),
      }),
    },
    {
      key: "overdue",
      icon: CircleAlert,
      value: money(overdue.total),
      hint: t("dashboard.tiles.overdueHint", { count: overdue.count }),
    },
    {
      key: "renewals",
      icon: CalendarClock,
      value: money(renewals.total),
      hint: t("dashboard.tiles.renewalsHint", { count: renewals.count, days: renewals.days }),
    },
    {
      key: "unhealthy",
      icon: Activity,
      value: formatCount(health.unhealthy),
      hint: t("dashboard.tiles.unhealthyHint", {
        failing: formatCount(health.failing),
        stale: formatCount(health.stale),
      }),
    },
  ] as const
  return (
    <section aria-label={t("dashboard.tiles.label")} className={STRIP}>
      {tiles.map((tile) => (
        <KpiTile
          key={tile.key}
          icon={tile.icon}
          label={t(`dashboard.tiles.${tile.key}`)}
          value={tile.value}
          hint={tile.hint}
          className="bg-card"
        />
      ))}
    </section>
  )
}
