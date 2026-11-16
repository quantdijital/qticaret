import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { maintenanceQuery } from "@/features/storefront/api/maintenance"
import { MaintenanceTab } from "@/features/storefront/components/maintenance-tab"

const M = "settings.maintenance"

/**
 * Settings > Maintenance (adr/0053): the switch that closes the storefront
 * at once, its bypass link and the dark page's texts, its state beside the
 * title. It left Storefront > Preferences when that left the sidebar (the
 * owner, 2026-11-16): saved at once and the owner's alone, it is no part of
 * the theme editor's draft.
 */
export function MaintenancePage() {
  const { t } = useTranslation()
  const dark = useQuery(maintenanceQuery()).data?.values.enabled === true
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${M}.title`)}
        description={t(`${M}.description`)}
        badge={dark ? <StatusBadge tone="warning">{t(`${M}.dark`)}</StatusBadge> : null}
      />
      <MaintenanceTab />
    </div>
  )
}
