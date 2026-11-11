import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import { plansQuery } from "@/features/packages/api"
import type { Plan } from "@/features/packages/api"
import { PackageDialog } from "@/features/packages/components/package-dialog"
import { limitText, priceText } from "@/features/packages/format"
import { canManagePackages } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"

type View = "active" | "archived"

/**
 * The packages (adr/0061 §2): on sale and archived in tabs, each with its
 * price, days, main limits and how many shops are on it. A row opens the
 * package in one dialog; owner and finance make, change (a price behind a
 * step-up) and archive them, the others read.
 */
export function PackagesPage() {
  const { t } = useTranslation()
  const me = useMe()
  const plans = useQuery(plansQuery())
  const [view, setView] = useState<View>("active")
  const [creating, setCreating] = useState(false)
  const all = plans.data?.plans
  const rows = all?.filter((plan) => (plan.archived_at === null) === (view === "active"))
  const walk = useRecordWalk(rows, (plan) => plan.id)
  const writable = canManagePackages(me?.role)
  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: t("packages.columns.name"),
      cell: (plan) => (
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            className="truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              walk.show(plan)
            }}
          >
            {plan.name}
          </button>
          <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
        </div>
      ),
    },
    { key: "price", header: t("packages.columns.price"), cell: (plan) => priceText(t, plan) },
    {
      key: "limits",
      header: t("packages.columns.limits"),
      className: "hidden lg:table-cell",
      cell: (plan) =>
        t("plan.pickerLimits", {
          products: limitText(t, "products", plan.limits.products),
          staff: limitText(t, "staff", plan.limits.staff),
        }),
    },
    {
      key: "days",
      header: t("packages.columns.days"),
      className: "hidden md:table-cell",
      cell: (plan) => t("packages.daysLine", { trial: plan.trial_days, grace: plan.grace_days }),
    },
    {
      key: "tenants",
      header: t("packages.columns.tenants"),
      align: "right",
      cell: (plan) => <span className="tabular-nums">{formatCount(plan.tenant_count ?? 0)}</span>,
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("packages.title")}
        description={t("packages.text")}
        action={
          writable ? (
            <Button
              onClick={() => {
                setCreating(true)
              }}
            >
              {t("packages.create")}
            </Button>
          ) : undefined
        }
      />
      {plans.isError ? (
        <ErrorState text={errorText(t, plans.error)} onRetry={() => void plans.refetch()} />
      ) : (
        <SectionCard title={t("packages.list")} flush>
          <FilterTabs<View>
            label={t("packages.tabsLabel")}
            value={view}
            onChange={setView}
            tabs={[
              {
                key: "active",
                label: t("packages.onSale"),
                count: all?.filter((plan) => plan.archived_at === null).length,
              },
              {
                key: "archived",
                label: t("packages.archived"),
                count: all?.filter((plan) => plan.archived_at !== null).length,
              },
            ]}
          />
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(plan) => plan.id}
            onRowClick={walk.show}
            loading={plans.isPending}
            empty={t(view === "active" ? "packages.empty" : "packages.emptyArchived")}
          />
        </SectionCard>
      )}
      {creating || walk.open ? (
        <PackageDialog
          plan={creating ? null : walk.open}
          steps={creating ? null : walk.steps}
          writable={writable}
          onClose={() => {
            setCreating(false)
            walk.close()
          }}
        />
      ) : null}
    </div>
  )
}
