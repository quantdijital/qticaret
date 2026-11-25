import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Info, Inbox } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterBar } from "@qticaret/admin-ui/patterns/filter-bar"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { ORDER_PAGE_SIZE, ORDER_STAGES, orderBoardQuery } from "@/features/orders/api/orders"
import type { BoardOrder, OrderBoard, OrderFilters as Filters } from "@/features/orders/api/orders"
import type { ShipResult } from "@/features/orders/api/shipping"
import { BulkBar } from "@/features/orders/components/bulk-bar"
import { useColumns } from "@/features/orders/components/order-columns"
import { useOrderFilters } from "@/features/orders/components/order-filters"
import type {
  ExtraOrderFilters,
  OrderFilterChange,
} from "@/features/orders/components/order-filters"
import { ShipResultsDialog } from "@/features/orders/components/ship-results-dialog"
import { isFiltered } from "@/features/orders/search"
import type { OrderListSearch } from "@/features/orders/search"
import { errorText } from "@/lib/errors"

interface OrderBoardCardProps {
  filters: Filters
  page: number
  search: OrderListSearch
  /** A new search (same filters, another page or text). */
  onSearch: (next: OrderListSearch) => void
  /** Another view: what was picked may not be in it. A page's own filters come in it too. */
  onRefilter: (next: OrderFilterChange) => void
  /** Columns after the list's own (the wholesaler on the wholesale list). */
  extraColumns?: Column<BoardOrder>[]
  /** Filters after the list's own, in its menu and chips (the wholesaler). */
  extraFilters?: ExtraOrderFilters
  /** A line under the filters, from the board's answer (a search found elsewhere). */
  notice?: (board: OrderBoard) => ReactNode
}

/**
 * The order list itself (docs/06 §4), shared by Siparişler and the
 * wholesale orders tab (ADR-0068 Ek 2026-11-15 (2)): stage tabs, search
 * and filters, picking several to ship or print, rows that open the
 * order's page, paging. Which orders it holds is the filters' `segment`.
 */
export function OrderBoardCard({
  filters,
  page,
  search,
  onSearch,
  onRefilter,
  extraColumns = [],
  extraFilters,
  notice,
}: OrderBoardCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const board = useQuery(orderBoardQuery({ ...filters, page }))
  const columns = [...useColumns(), ...extraColumns]
  // Orders picked to ship or print at once (F7.7), kept with their row for the results' numbers
  const [picked, setPicked] = useState<Map<string, BoardOrder>>(new Map())
  const [results, setResults] = useState<{
    list: ShipResult[]
    orders: Map<string, BoardOrder>
  } | null>(null)
  const refilter = (next: OrderFilterChange) => {
    setPicked(new Map())
    onRefilter(next)
  }
  const filterBar = useOrderFilters(search, refilter, extraFilters)
  const narrowed =
    isFiltered(search) ||
    (extraFilters?.filters ?? []).some((filter) => extraFilters?.values[filter.key] !== undefined)
  return (
    <>
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
        <FilterBar
          className="px-5 py-3"
          {...filterBar}
          search={
            <SearchInput
              className="sm:max-w-none"
              value={filters.q}
              placeholder={t("orders.search")}
              onChange={(text) => {
                onSearch({ q: text, page: 1 })
              }}
            />
          }
          note={
            board.data?.limited ? (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-lh w-3.5 shrink-0" aria-hidden="true" />
                {t("orders.limited")}
              </p>
            ) : null
          }
        />
        {board.data && notice ? notice(board.data) : null}
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
                    {filters.q || narrowed
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
                  onSearch({ page: next + 1 })
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
    </>
  )
}
