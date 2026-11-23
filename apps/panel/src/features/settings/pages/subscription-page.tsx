import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { dayOf } from "@qticaret/admin-ui/lib/days"
import { planQuery } from "@/features/settings/api/plan"
import { PaymentCard } from "@/features/settings/components/payment-card"
import { PlanCard } from "@/features/settings/components/plan-card"
import { UsageCard } from "@/features/settings/components/usage-card"
import { countdownOf, planState } from "@/features/settings/subscription-rules"
import { errorText } from "@/lib/errors"

// The usual five tiles as the loaded page lays them out: three totals, two monthly
const TILE_SPANS = [
  "sm:col-span-2",
  "sm:col-span-2",
  "sm:col-span-2",
  "sm:col-span-3",
  "sm:col-span-3",
]

/** The page's shape while it loads: the package and payment side by side, the tiles under them. */
function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" className="flex flex-col gap-[var(--grid-gap)]">
      <span className="sr-only">{t("plan.loading")}</span>
      <PageGrid>
        <PageColumn span={8}>
          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="ml-auto h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-44" />
                <Skeleton className="h-7 w-56 rounded-full" />
              </div>
              <Skeleton className="size-[104px] rounded-full" />
            </div>
          </div>
        </PageColumn>
        <PageColumn span={4}>
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-card">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-5 w-36" />
          </div>
        </PageColumn>
      </PageGrid>
      <Skeleton className="h-6 w-44" />
      <div className="grid grid-cols-1 gap-[var(--grid-gap)] sm:grid-cols-6 xl:grid-cols-5">
        {TILE_SPANS.map((span, index) => (
          <div
            key={index}
            className={`flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card xl:col-span-1 ${span}`}
          >
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Settings > Abonelik (adr/0061 §5.6, Ek C14, C16), read only and at a
 * glance: the package card (name, status, amount due, its day and a
 * countdown ring), how to pay beside it, a tile per limit under them. A
 * shop without a control plane shows only the tiles, every one unlimited.
 */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const plan = useQuery(planQuery())
  const today = dayOf(new Date())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("plan.title")} description={t("plan.description")} />
      {plan.isPending ? (
        <PageSkeleton />
      ) : plan.isError || !plan.data ? (
        <ErrorState
          text={plan.isError ? errorText(t, plan.error) : t("plan.loadFailed")}
          onRetry={() => void plan.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-[var(--grid-gap)]">
          {plan.data.managed ? (
            <PageGrid>
              <PageColumn span={8}>
                <PlanCard
                  plan={plan.data}
                  state={planState(plan.data, today)}
                  countdown={countdownOf(planState(plan.data, today), plan.data.billing, today)}
                />
              </PageColumn>
              <PageColumn span={4}>
                <PaymentCard plan={plan.data} />
              </PageColumn>
            </PageGrid>
          ) : null}
          <UsageCard plan={plan.data} />
        </div>
      )}
    </div>
  )
}
