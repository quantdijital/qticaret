import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import { flagName, flagText } from "@/features/packages/format"
import type { EffectiveFlag, TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { FeatureOverrideDialog } from "./feature-override-dialog"

/**
 * The shop's platform flags (adr/0061 Ek C9), beside its limits: each with
 * the package's value, the shop's own exception (its reason and end
 * beneath) and what its plan document carries. Owner and operator open a
 * row to give or remove an exception. None in force: the card says so.
 */
export function FlagsCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const writable = canManageShops(me?.role) && shop.package !== null
  const [open, setOpen] = useState<string | null>(null)
  const overrideOf = (key: string) => shop.feature_overrides.find((each) => each.key === key)
  const columns: Column<EffectiveFlag>[] = [
    {
      key: "flag",
      header: t("flags.columns.flag"),
      cell: (row) => <span className="font-medium">{flagName(t, row.key)}</span>,
    },
    {
      key: "package",
      header: t("plan.columns.package"),
      className: "hidden sm:table-cell",
      cell: (row) => flagText(t, row.package ?? row.default),
    },
    {
      key: "override",
      header: t("plan.columns.override"),
      cell: (row) => {
        const own = overrideOf(row.key)
        if (!own) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <div className="flex min-w-0 flex-col">
            <span>{flagText(t, own.enabled)}</span>
            <span className="truncate text-xs text-muted-foreground">
              {own.expires_at
                ? t("plan.until", { reason: own.reason, date: formatDate(own.expires_at) })
                : own.reason}
            </span>
          </div>
        )
      },
    },
    {
      key: "applies",
      header: t("plan.columns.applies"),
      align: "right",
      cell: (row) => <span className="font-medium">{flagText(t, row.value)}</span>,
    },
  ]
  const flag = open ? shop.features.find((each) => each.key === open) : undefined
  return (
    <SectionCard title={t("flags.title")} description={t("flags.shopText")} flush>
      <DataTable
        columns={columns}
        rows={shop.features}
        rowKey={(row) => row.key}
        {...(writable
          ? {
              onRowClick: (row: EffectiveFlag) => {
                setOpen(row.key)
              },
            }
          : {})}
        empty={t("flags.none")}
      />
      {writable && flag ? (
        <FeatureOverrideDialog
          tenantId={shop.tenant.id}
          flag={flag}
          override={overrideOf(flag.key) ?? null}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
