import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { LimitKey } from "@qticaret/types/control-plane"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import { limitText, priceText } from "@/features/packages/format"
import type { EffectiveLimit, TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { OverrideDialog } from "./override-dialog"
import { PlanDialog } from "./plan-dialog"

/**
 * The shop's package and what it may use (adr/0061 §2): each registry
 * limit with the package's value, the shop's own exception (its reason
 * and end beneath) and what applies. Owner and operator change the
 * package and open a limit's row to give or remove an exception.
 */
export function PlanCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const writable = canManageShops(me?.role)
  const [choosing, setChoosing] = useState(false)
  const [limit, setLimit] = useState<LimitKey | null>(null)
  const overrideOf = (key: LimitKey) => shop.overrides.find((each) => each.key === key)
  const columns: Column<EffectiveLimit>[] = [
    {
      key: "limit",
      header: t("plan.columns.limit"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{t(`limits.keys.${row.key}`)}</span>
          {row.key === "orders_per_month" ? (
            <span className="text-xs text-muted-foreground">{t("limits.warnOnly")}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "package",
      header: t("plan.columns.package"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (row) => <span className="tabular-nums">{limitText(t, row.key, row.package)}</span>,
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
            <span className="tabular-nums">{limitText(t, row.key, own.value)}</span>
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
      cell: (row) => (
        <span className="font-medium tabular-nums">{limitText(t, row.key, row.value)}</span>
      ),
    },
  ]
  return (
    <SectionCard
      title={t("plan.title")}
      description={
        shop.package
          ? t("plan.on", { name: shop.package.name, price: priceText(t, shop.package) })
          : t("plan.noPackage")
      }
      action={
        writable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setChoosing(true)
            }}
          >
            {t(shop.package ? "plan.change" : "plan.assign")}
          </Button>
        ) : undefined
      }
      flush
    >
      <DataTable
        columns={columns}
        rows={shop.limits}
        rowKey={(row) => row.key}
        {...(writable
          ? {
              onRowClick: (row: EffectiveLimit) => {
                setLimit(row.key)
              },
            }
          : {})}
        empty={t("plan.noPackage")}
      />
      {writable ? (
        <>
          {choosing ? (
            <PlanDialog
              tenantId={shop.tenant.id}
              current={shop.package?.id ?? null}
              onClose={() => {
                setChoosing(false)
              }}
            />
          ) : null}
          {limit ? (
            <OverrideDialog
              tenantId={shop.tenant.id}
              limit={shop.limits.find((each) => each.key === limit) ?? { key: limit, value: null }}
              override={overrideOf(limit) ?? null}
              onClose={() => {
                setLimit(null)
              }}
            />
          ) : null}
        </>
      ) : null}
    </SectionCard>
  )
}
