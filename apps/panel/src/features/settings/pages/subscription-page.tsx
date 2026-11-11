import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { planQuery } from "@/features/settings/api/plan"
import {
  BillingCard,
  PackageCard,
  UsageCard,
} from "@/features/settings/components/subscription-cards"
import { errorText } from "@/lib/errors"

/**
 * Settings > Abonelik (adr/0061 §5.6, Ek C14), read only: the limits and
 * their use on the left, the package and payment in the right column. A
 * shop without a control plane says it has no limits and shows its use.
 * Grace and restriction banners are C15's; limit notices sit on their own
 * screens (products, team, media, drafts, orders).
 */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const plan = useQuery(planQuery())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("plan.title")} description={t("plan.description")} />
      {plan.isPending ? (
        <LoadingRows rows={4} />
      ) : plan.isError || !plan.data ? (
        <ErrorState
          text={plan.isError ? errorText(t, plan.error) : t("plan.loadFailed")}
          onRetry={() => void plan.refetch()}
        />
      ) : plan.data.managed ? (
        <PageGrid>
          <PageColumn span={8}>
            <UsageCard plan={plan.data} />
          </PageColumn>
          <PageColumn span={4}>
            <PackageCard plan={plan.data} />
            <BillingCard plan={plan.data} />
          </PageColumn>
        </PageGrid>
      ) : (
        <UsageCard plan={plan.data} />
      )}
    </div>
  )
}
