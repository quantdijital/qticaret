import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { TenantDetail } from "@/features/tenants/api"
import { errorText } from "@/lib/errors"
import { usageHealthQuery } from "../api"
import { HealthCard } from "./health-card"
import { UsageCard } from "./usage-card"

/**
 * The shop's "Kullanım ve sağlık" tab (Ek C13), every role's: its usage
 * against its limits beside its health, two cards of one height. Read
 * again every minute while the tab is open and in view.
 */
export function UsageHealthTab({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const query = useQuery(usageHealthQuery(shop.tenant.id))
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return <Skeleton className="h-64 rounded-lg" />
  }
  return (
    <PageGrid>
      <PageColumn span={7}>
        <UsageCard shop={shop} data={query.data} />
      </PageColumn>
      <PageColumn span={5}>
        <HealthCard data={query.data} />
      </PageColumn>
    </PageGrid>
  )
}
