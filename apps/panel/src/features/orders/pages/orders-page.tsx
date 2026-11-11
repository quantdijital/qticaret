import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Info, Inbox } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ORDER_PAGE_SIZE, ORDER_STAGES, orderBoardQuery } from "@/features/orders/api/orders"
import type { BoardOrder, OrderFilters as Filters } from "@/features/orders/api/orders"
import type { ShipResult } from "@/features/orders/api/shipping"
import { BulkBar } from "@/features/orders/components/bulk-bar"
import { useColumns } from "@/features/orders/components/order-columns"
import { OrderExportButton } from "@/features/orders/components/order-export"
import { OrderFilters } from "@/features/orders/components/order-filters"
import { ShipResultsDialog } from "@/features/orders/components/ship-results-dialog"
import { isFiltered } from "@/features/orders/search"
import type { OrderListSearch } from "@/features/orders/search"
import { PaymentLinkButtons } from "@/features/payment-links/components/order-buttons"
import { LimitNotice } from "@/features/settings/components/limit-notice"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/orders/")

/** The address's search without its empty parts: an "all" tab, an empty search, page 1. */
const cleanSearch = (search: OrderListSearch): OrderListSearch => ({
  q: search.q === "" ? undefined : search.q,
  stage: search.stage === "all" ? undefined : search.stage,
  payment: search.payment,
  shipping: search.shipping,
  method: search.method,
  carrier: search.carrier,
  from: search.from,
  to: search.to,
  page: search.page && search.page > 1 ? search.page : undefined,
})

/** Every order by stage (docs/06 §4): what needs packing first, then the rest. */
export function OrdersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const page = (search.page ?? 1) - 1
  const filters: Filters = {
    stage: search.stage ?? "all",
    q: search.q ?? "",
    payment: search.payment,
    shipping: search.shipping,
    method: search.method,
    carrier: search.carrier,
    from: search.from,
    to: search.to,
  }
  const board = useQuery(orderBoardQuery({ ...filters, page }))
  const columns = useColumns()
  // Orders picked to ship or print at once (F7.7), kept with their row for the results' numbers
  const [picked, setPicked] = useState<Map<string, BoardOrder>>(new Map())
  const [results, setResults] = useState<{
    list: ShipResult[]
    orders: Map<string, BoardOrder>
  } | null>(null)
  const setSearch = (next: OrderListSearch) => {
    void navigate({ to: "/orders", search: cleanSearch({ ...search, ...next }), replace: true })
  }
  // Another view: what was picked may not be in it
  const refilter = (next: OrderListSearch) => {
    setPicked(new Map())
    setSearch({ ...next, page: 1 })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.orders")}
        description={t("orders.description")}
        action={
          <span className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/review">{t("orders.fraud.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/returns">{t("orders.returns.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/chargebacks">{t("orders.chargeback.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/invoices">{t("orders.invoice.queue")}</Link>
            </Button>
            {/* The list as it is filtered, as a file: the owner's alone */}
            <OrderExportButton filters={filters} />
            {/* adr/0051: staff-made orders paid through a link, while the shop has them on */}
            <PaymentLinkButtons />
          </span>
        }
      />
      {/* adr/0061 Ek C14: the month's orders near or past the package's limit; never stopped */}
      <LimitNotice limit="orders_per_month" />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("orders.views")}
          value={filters.stage}
          onChange={(next) => {
            refilter({ stage: next })
          }}
          tabs={ORDER_STAGES.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`stage.${key}`),
            count: board.data?.counts[key],
          }))}
        />
        <div className="grid grid-cols-1 gap-2 px-5 py-3 sm:flex sm:flex-wrap sm:items-center">
          <SearchInput
            className="sm:w-80 sm:max-w-none"
            value={filters.q}
            placeholder={t("orders.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          <OrderFilters search={search} onChange={refilter} />
          {board.data?.limited ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-lh w-3.5 shrink-0" aria-hidden="true" />
              {t("orders.limited")}
            </p>
          ) : null}
        </div>
        {picked.size > 0 ? (
          <BulkBar
            picked={picked}
            onClear={() => {
              setPicked(new Map())
            }}
            onShipped={(list) => {
              setResults({ list, orders: picked })
              setPicked(new Map())
            }}
          />
        ) : null}
        {board.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, board.error)} onRetry={() => void board.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={board.data?.orders}
              rowKey={(order) => order.id}
              loading={board.isPending}
              stale={board.isPlaceholderData}
              onRowClick={(order) => {
                void navigate({ to: "/orders/$id", params: { id: order.id } })
              }}
              selection={{
                selected: new Set(picked.keys()),
                onChange: (next: Set<string>) => {
                  const rows = new Map([
                    ...picked,
                    ...(board.data?.orders ?? []).map((order) => [order.id, order] as const),
                  ])
                  setPicked(
                    new Map(
                      [...next].flatMap((id) => {
                        const row = rows.get(id)
                        return row ? [[id, row] as const] : []
                      })
                    )
                  )
                },
                rowLabel: (order: BoardOrder) => `#${String(order.display_id)}`,
              }}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {filters.q || isFiltered(search)
                      ? t("orders.noMatch")
                      : filters.stage === "all"
                        ? t("orders.empty")
                        : t("orders.emptyStage")}
                  </p>
                </div>
              }
            />
            {board.data && board.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={ORDER_PAGE_SIZE}
                count={board.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
      <ShipResultsDialog
        results={results?.list ?? null}
        orders={results?.orders ?? new Map()}
        onClose={() => {
          setResults(null)
        }}
      />
    </div>
  )
}
