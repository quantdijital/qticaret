import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus, UsersRound } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import {
  CUSTOMER_PAGE_SIZE,
  customerCountsQuery,
  customerStatsQuery,
  customersQuery,
} from "@/features/customers/api/customers"
import type { CustomerKind } from "@/features/customers/api/customers"
import { ColumnOptions } from "@/features/customers/components/column-options"
import { CustomerExportButton } from "@/features/customers/components/customer-export"
import { useCustomerColumns } from "@/features/customers/components/customer-columns"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { STATS_COLUMNS, useHiddenColumns } from "@/features/customers/list-prefs"
import { NewCustomerDialog } from "@/features/wholesale/components/new-customer-dialog"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/customers/")

/** Everyone who ordered or signed up; members and guests apart. */
export function CustomersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const kind = search.kind ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const list = useQuery(customersQuery({ q, kind, page }))
  const counts = useQuery(customerCountsQuery())
  const [hidden, setHidden] = useHiddenColumns()
  // The page's customers' numbers in one read (CU1); none when no numbers column stands
  const wantsStats = STATS_COLUMNS.some((column) => !hidden.includes(column))
  const ids = wantsStats ? (list.data?.customers.map((customer) => customer.id) ?? []) : []
  const stats = useQuery(customerStatsQuery(ids))
  const columns = useCustomerColumns(hidden, stats.isError ? null : stats.data)
  const mayAdd = useCan("customers")
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { q?: string; kind?: CustomerKind; page?: number }) => {
    const nextKind = next.kind ?? kind
    void navigate({
      to: "/customers",
      search: {
        q: (next.q ?? q) || undefined,
        kind: nextKind === "all" ? undefined : nextKind,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.customers")}
        description={t("customers.description")}
        action={
          mayAdd ? (
            <Button
              onClick={() => {
                setAdding(true)
              }}
            >
              <Plus />
              {t("customers.form.newTitle")}
            </Button>
          ) : undefined
        }
      />
      {mayAdd ? <NewCustomerDialog open={adding} onOpenChange={setAdding} /> : null}
      <CustomersNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("customers.views")}
          value={kind}
          onChange={(next) => {
            setSearch({ kind: next, page: 1 })
          }}
          tabs={[
            { key: "all", label: t("customers.tabs.all"), count: counts.data?.all },
            {
              key: "registered",
              label: t("customers.tabs.registered"),
              count: counts.data?.registered,
            },
            { key: "guest", label: t("customers.tabs.guest"), count: counts.data?.guest },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("customers.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            <CustomerExportButton q={q} kind={kind} />
            <ColumnOptions hidden={hidden} onChange={setHidden} />
          </div>
        </div>
        {list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.customers}
              rowKey={(customer) => customer.id}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              onRowClick={(customer) => {
                void navigate({ to: "/customers/$id", params: { id: customer.id } })
              }}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <UsersRound className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {q ? t("customers.noMatch") : t("customers.empty")}
                  </p>
                </div>
              }
            />
            {list.data && list.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={CUSTOMER_PAGE_SIZE}
                count={list.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
