import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { useCan } from "@/features/auth/api/staff"
import { maintenanceQuery } from "@/features/storefront/api/maintenance"
import { errorText } from "@/lib/errors"
import { MaintenanceBypassCard } from "./maintenance-bypass-card"
import { MaintenancePageCard } from "./maintenance-page-card"
import { MaintenanceStatusCard } from "./maintenance-status-card"

/**
 * Storefront > Preferences > Maintenance (adr/0053): the switch and the
 * bypass link side by side, the dark page's texts under them. Writing is
 * the owner's (`can.maintenance`); the link is the owner's and the admin's.
 */
export function MaintenanceTab() {
  const { t } = useTranslation()
  const query = useQuery(maintenanceQuery())
  const canWrite = useCan("maintenance")
  // The admin may make a link though not flip the switch, as with a draft's preview
  const canBypass = useCan("settings")
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return <LoadingRows rows={5} />
  }
  const { values, version } = query.data
  return (
    <PageGrid>
      <PageColumn span={6}>
        <MaintenanceStatusCard saved={values} canWrite={canWrite} />
      </PageColumn>
      <PageColumn span={6}>
        <MaintenanceBypassCard enabled={values.enabled} version={version} canCreate={canBypass} />
      </PageColumn>
      <PageColumn span={12}>
        <MaintenancePageCard saved={values} canWrite={canWrite} />
      </PageColumn>
    </PageGrid>
  )
}
