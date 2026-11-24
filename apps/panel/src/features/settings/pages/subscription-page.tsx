import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { dayOf } from "@qticaret/admin-ui/lib/days"
import { planPaymentsQuery, planQuery } from "@/features/settings/api/plan"
import { PaymentCard } from "@/features/settings/components/payment-card"
import { PaymentsHistoryCard } from "@/features/settings/components/payments-history-card"
import { PlanCard } from "@/features/settings/components/plan-card"
import { UnlinkedPlanCard } from "@/features/settings/components/unlinked-plan-card"
import { UsageCard } from "@/features/settings/components/usage-card"
import {
  countdownOf,
  lastPaymentOf,
  planState,
  trialProgress,
} from "@/features/settings/subscription-rules"
import { errorText } from "@/lib/errors"

// The usual groups of tiles as the loaded page lays them out: three shop totals, two monthly
const TILE_GROUPS = [
  { count: 3, columns: "sm:grid-cols-3" },
  { count: 2, columns: "sm:grid-cols-2" },
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
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
      {TILE_GROUPS.map((group) => (
        <div
          key={group.count}
          className={`grid grid-cols-1 gap-[var(--grid-gap)] ${group.columns}`}
        >
          {Array.from({ length: group.count }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card"
            >
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Settings > Abonelik (adr/0061 §5.6, Ek C14, C16, C20), read only and at
 * a glance: the package card (name, status, amount due, its day and a
 * countdown ring; under them the billing cycle, price, last payment, the
 * limits' month and what the package includes), how to pay beside it,
 * the limits in two groups under them, the payments to the platform last.
 * A shop the platform does not manage yet says so in the package's place
 * and shows the tiles, every one unlimited.
 */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const plan = useQuery(planQuery())
  const managed = plan.data?.managed === true
  // The payments card's own query (one request for both): the card's last payment
  const payments = useQuery({ ...planPaymentsQuery(), enabled: managed })
  const lastPayment =
    payments.data?.state === "ok" ? lastPaymentOf(payments.data.records) : undefined
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
                  trial={trialProgress(plan.data.billing, today)}
                  lastPayment={lastPayment}
                />
              </PageColumn>
              <PageColumn span={4}>
                <PaymentCard plan={plan.data} />
              </PageColumn>
            </PageGrid>
          ) : (
            <UnlinkedPlanCard />
          )}
          <UsageCard plan={plan.data} />
          {plan.data.managed ? <PaymentsHistoryCard today={today} /> : null}
        </div>
      )}
    </div>
  )
}
