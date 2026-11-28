import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useMe } from "@/features/auth/api"
import type { Domain, TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { AddDomainDialog, DomainDialog } from "./domain-dialogs"
import { VerificationBadge } from "./verification-badge"

/**
 * The host names the shop answers on (adr/0061 §2): its subdomain on the
 * platform, always there, and its own domains with their DNS check
 * (F16.7); the primary one marked. A row opens the domain (its records
 * to publish, "Doğrula"); a domain just added opens itself. Owner and
 * operator add, check, remove and choose the primary one.
 */
export function DomainsCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const writable = canManageShops(me?.role)
  const walk = useRecordWalk(shop.domains, (domain) => domain.id)
  const [adding, setAdding] = useState(false)
  // The new domain's window opens at once; the list's copy (its records to publish) replaces
  // this one when the shop is read again
  const showAdded = (domain: { id: string; hostname: string }) => {
    walk.show({
      ...domain,
      kind: "custom",
      verification: "pending",
      is_primary: false,
      dns: null,
      created_at: new Date().toISOString(),
    })
  }
  const columns: Column<Domain>[] = [
    {
      key: "host",
      header: t("domains.columns.host"),
      cell: (domain) => (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className="truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              walk.show(domain)
            }}
          >
            {domain.hostname}
          </button>
          {domain.is_primary ? <StatusBadge tone="info">{t("domains.primary")}</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: "kind",
      header: t("domains.columns.kind"),
      className: "hidden md:table-cell",
      cell: (domain) => t(`domains.kinds.${domain.kind}`),
    },
    {
      key: "state",
      header: t("domains.columns.state"),
      align: "right",
      cell: (domain) => <VerificationBadge domain={domain} />,
    },
  ]
  return (
    <SectionCard
      title={t("domains.title")}
      description={t("domains.text")}
      action={
        writable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding(true)
            }}
          >
            {t("domains.add")}
          </Button>
        ) : undefined
      }
      flush
    >
      <DataTable
        columns={columns}
        rows={shop.domains}
        rowKey={(domain) => domain.id}
        onRowClick={walk.show}
        empty={t("domains.empty")}
      />
      {writable ? (
        <AddDomainDialog
          tenantId={shop.tenant.id}
          open={adding}
          onOpenChange={setAdding}
          onAdded={showAdded}
        />
      ) : null}
      <DomainDialog
        tenantId={shop.tenant.id}
        domain={walk.open}
        steps={walk.steps}
        writable={writable}
        onClose={walk.close}
      />
    </SectionCard>
  )
}
