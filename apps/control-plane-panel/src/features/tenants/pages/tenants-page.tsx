import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import { TENANTS_PAGE_SIZE, tenantsQuery } from "@/features/tenants/api"
import type { TenantRow } from "@/features/tenants/api"
import { CreateTenantDialog } from "@/features/tenants/components/create-tenant-dialog"
import { TenantStatusBadge } from "@/features/tenants/components/tenant-status"
import { canManageShops } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_app/tenants/")

type View = TenantStatus | "all"

/**
 * The platform's shops (adr/0061 §2): newest first, by status in tabs with
 * their counts, by name or address; a row opens the shop's page. A new
 * shop is a record here (owner, operator); its setup comes with C10/C11.
 */
export function TenantsPage() {
  const { t } = useTranslation()
  const me = useMe()
  const { status, q, page } = route.useSearch()
  const navigate = useNavigate({ from: "/tenants/" })
  const [creating, setCreating] = useState(false)
  const list = useQuery(tenantsQuery({ status, q, page: page - 1 }))
  const go = (next: Partial<{ status: View; q: string; page: number }>) => {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...next }) })
  }
  const open = (row: TenantRow) => {
    void navigate({ to: "/tenants/$id", params: { id: row.id } })
  }
  const counts = list.data?.counts
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : undefined
  const columns: Column<TenantRow>[] = [
    {
      key: "shop",
      header: t("tenants.columns.shop"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {/* The row opens the shop; the keyboard reaches it through this link */}
          <Link
            to="/tenants/$id"
            params={{ id: row.id }}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {row.name}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {row.primary_hostname ?? row.slug}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: t("tenants.columns.status"),
      cell: (row) => <TenantStatusBadge status={row.status} />,
    },
    {
      key: "package",
      header: t("tenants.columns.package"),
      cell: (row) =>
        row.package ? (
          row.package.name
        ) : (
          <span className="text-muted-foreground">{t("tenants.noPackage")}</span>
        ),
    },
    {
      key: "next",
      header: t("tenants.columns.nextPayment"),
      className: "hidden lg:table-cell",
      cell: (row) => (row.next_payment_on ? formatDate(row.next_payment_on) : "—"),
    },
    {
      key: "created",
      header: t("tenants.columns.created"),
      className: "hidden md:table-cell",
      cell: (row) => formatDate(row.created_at),
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("tenants.title")}
        description={t("tenants.text")}
        action={
          canManageShops(me?.role) ? (
            <Button
              onClick={() => {
                setCreating(true)
              }}
            >
              {t("tenants.create.open")}
            </Button>
          ) : undefined
        }
      />
      {list.isError ? (
        <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <SectionCard title={t("tenants.list")} flush>
          <FilterTabs<View>
            label={t("tenants.tabsLabel")}
            value={status}
            onChange={(next) => {
              go({ status: next })
            }}
            tabs={[
              { key: "all", label: t("tenants.all"), count: total },
              ...TENANT_STATUSES.map((each) => ({
                key: each,
                label: t(`tenants.status.${each}`),
                count: counts?.[each],
              })),
            ]}
          />
          <div className="border-b px-5 py-3">
            <SearchInput
              value={q}
              onChange={(next) => {
                go({ q: next })
              }}
              placeholder={t("tenants.search")}
              className="sm:max-w-sm"
            />
          </div>
          <DataTable
            columns={columns}
            rows={list.data?.tenants}
            rowKey={(row) => row.id}
            onRowClick={open}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            empty={t(q ? "tenants.emptySearch" : "tenants.empty")}
          />
          <Pagination
            page={page - 1}
            pageSize={TENANTS_PAGE_SIZE}
            count={list.data?.count ?? 0}
            onPageChange={(next) => {
              go({ page: next + 1 })
            }}
          />
        </SectionCard>
      )}
      <CreateTenantDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
