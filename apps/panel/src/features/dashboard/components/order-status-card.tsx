import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { StackedBar } from "@qticaret/admin-ui/charts/stacked-bar"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { DashboardOverview, Lifecycle } from "@/features/dashboard/api/overview"
import { formatCount } from "@qticaret/admin-ui/lib/format"

// An order's life is ordered: an ordinal ramp of the brand hue; canceled apart, in red
const STAGES: { key: Lifecycle; color: string }[] = [
  { key: "awaiting_payment", color: "var(--chart-ramp-1)" },
  { key: "to_ship", color: "var(--chart-ramp-2)" },
  { key: "shipped", color: "var(--chart-ramp-3)" },
  { key: "delivered", color: "var(--chart-ramp-4)" },
  { key: "canceled", color: "var(--chart-canceled)" },
]

function Statuses({ overview }: { overview: DashboardOverview }) {
  const { t } = useTranslation()
  const total = STAGES.reduce((sum, stage) => sum + overview.statuses[stage.key], 0)
  if (total === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("dashboard.statuses.empty")}</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <span className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
        {t("dashboard.statuses.total", { count: total, formatted: formatCount(total) })}
      </span>
      <StackedBar
        segments={STAGES.map((stage) => ({
          key: stage.key,
          label: t(`stage.${stage.key}`),
          value: overview.statuses[stage.key],
          color: stage.color,
        }))}
      />
    </div>
  )
}

/** Where the period's orders stand, as one bar and a legend with counts. */
export function OrderStatusCard({
  query,
  className,
}: {
  query: UseQueryResult<DashboardOverview>
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("dashboard.statuses.title")}
      description={t("dashboard.statuses.description")}
      className={className}
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
      >
        {(overview) => <Statuses overview={overview} />}
      </AsyncBody>
    </SectionCard>
  )
}
