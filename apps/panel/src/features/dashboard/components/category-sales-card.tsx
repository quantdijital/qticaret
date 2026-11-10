import type { UseQueryResult } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { BarList } from "@qticaret/admin-ui/charts/bar-list"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"

function Categories({ overview }: { overview: DashboardOverview }) {
  const { t } = useTranslation()
  const rows = overview.categories
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("dashboard.categories.empty")}</p>
  }
  const total = rows.reduce((sum, row) => sum + Number(row.sales), 0)
  return (
    <BarList
      items={rows.map((row) => ({
        key: row.key,
        label:
          row.kind === "category"
            ? (row.name ?? "")
            : t(`dashboard.categories.${row.kind === "other" ? "other" : "uncategorized"}`),
        value: Number(row.sales),
        display: formatMoney(row.sales, overview.currency_code),
        sub: total > 0 ? formatPercent(Number(row.sales) / total) : "",
        muted: row.kind !== "category",
      }))}
    />
  )
}

/** How the period's sales split across categories. */
export function CategorySalesCard({
  query,
  limit,
  action,
  className,
}: {
  query: UseQueryResult<DashboardOverview>
  /** The first rows only (a summary pointing to the full report). */
  limit?: number
  /** Right of the title: a link to the full list. */
  action?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("dashboard.categories.title")}
      description={t("dashboard.categories.description")}
      action={action}
      className={className}
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        }
      >
        {(overview) => (
          <Categories
            overview={
              limit === undefined
                ? overview
                : { ...overview, categories: overview.categories.slice(0, limit) }
            }
          />
        )}
      </AsyncBody>
    </SectionCard>
  )
}
