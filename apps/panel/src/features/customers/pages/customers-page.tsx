import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus, UsersRound } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Avatar, AvatarFallback } from "@qticaret/admin-ui/ui/avatar"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import {
  CUSTOMER_PAGE_SIZE,
  customerCountsQuery,
  customersQuery,
} from "@/features/customers/api/customers"
import type { CustomerKind, CustomerListItem } from "@/features/customers/api/customers"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { customerName, initialsOf } from "@/features/customers/names"
import { NewCustomerDialog } from "@/features/wholesale/components/new-customer-dialog"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/customers/")

function useColumns(): Column<CustomerListItem>[] {
  const { t } = useTranslation()
  return [
    {
      key: "customer",
      header: t("customers.columns.customer"),
      cell: (customer) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-muted text-xs font-medium">
              {initialsOf(customer)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <Link
              to="/customers/$id"
              params={{ id: customer.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {customerName(customer) ?? t("orders.noName")}
            </Link>
            <span className="truncate text-xs text-muted-foreground">{customer.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: t("customers.columns.kind"),
      cell: (customer) => (
        <StatusBadge tone={customer.has_account ? "info" : "neutral"}>
          {t(customer.has_account ? "customers.kind.registered" : "customers.kind.guest")}
        </StatusBadge>
      ),
    },
    {
      key: "joined",
      header: t("customers.columns.joined"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (customer) => (
        <span className="text-muted-foreground">
          {customer.created_at ? formatDate(customer.created_at) : "—"}
        </span>
      ),
    },
  ]
}

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
  const columns = useColumns()
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
