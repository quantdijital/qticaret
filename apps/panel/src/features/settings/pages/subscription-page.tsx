import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { dayOf } from "@qticaret/admin-ui/lib/days"
import { planQuery } from "@/features/settings/api/plan"
import { PaymentCard, PlanCard } from "@/features/settings/components/plan-card"
import { UsageCard } from "@/features/settings/components/usage-card"
import { planState } from "@/features/settings/subscription-rules"
import { errorText } from "@/lib/errors"

/** The page's shape while it loads: the package and payment side by side, the use under them. */
function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("plan.loading")}</span>
      <PageGrid>
        <PageColumn span={8}>
          <Skeleton className="h-56 w-full rounded-lg" />
        </PageColumn>
        <PageColumn span={4}>
          <Skeleton className="h-56 w-full rounded-lg" />
        </PageColumn>
        <PageColumn span={12}>
          <Skeleton className="h-72 w-full rounded-lg" />
        </PageColumn>
      </PageGrid>
    </div>
  )
}

/**
 * Settings > Abonelik (adr/0061 §5.6, Ek C14, C16), read only: the
 * package with one status and the next payment at the top, how to pay
 * beside it, the limits and their use under them in two groups. A shop
 * without a control plane says it has no limits and shows its use. The
 * restricted shop's strip and the payment strip are above every page;
 * limit notices sit on their own screens.
 */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const plan = useQuery(planQuery())
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
        <PageGrid>
          {plan.data.managed ? (
            <>
              <PageColumn span={8}>
                <PlanCard plan={plan.data} state={planState(plan.data, dayOf(new Date()))} />
              </PageColumn>
              <PageColumn span={4}>
                <PaymentCard plan={plan.data} />
              </PageColumn>
            </>
          ) : null}
          <PageColumn span={12}>
            <UsageCard plan={plan.data} />
          </PageColumn>
        </PageGrid>
      )}
    </div>
  )
}
