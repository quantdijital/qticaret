import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { useMe } from "@/features/auth/api"
import { BackupCard } from "@/features/provisioning/components/backup-card"
import { UpgradeCard } from "@/features/provisioning/components/upgrade-card"
import type { TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { VersionCard } from "./version-card"

/**
 * The shop's "Sürüm ve yedek" tab: what it runs and its target (Ek C18)
 * beside, for who runs shops, its upgrade (audit 3.1); its latest backup
 * under it, every role's (audit 3.2).
 */
export function VersionTab({ shop }: { shop: TenantDetail }) {
  const me = useMe()
  return (
    <PageGrid>
      <PageColumn span={7}>
        <VersionCard shop={shop} />
      </PageColumn>
      <PageColumn span={5}>
        {canManageShops(me?.role) ? <UpgradeCard shop={shop} /> : null}
        <BackupCard shop={shop} />
      </PageColumn>
    </PageGrid>
  )
}
