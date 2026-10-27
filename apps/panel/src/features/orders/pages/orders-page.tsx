import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Info, Inbox } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { ORDER_PAGE_SIZE, ORDER_STAGES, orderBoardQuery } from "@/features/orders/api/orders"
import type { BoardOrder, OrderStage } from "@/features/orders/api/orders"
import { CustomerCell } from "@/features/orders/components/customer-cell"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format"

const route = getRouteApi("/_auth/orders/")

function useColumns(): Column<BoardOrder>[] {
  const { t } = useTranslation()
  return [
    {
      key: "order",
      header: t("orders.columns.order"),
      cell: (order) => (
        <Link
          to="/orders/$id"
          params={{ id: order.id }}
          className="tabular font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          #{order.display_id}
        </Link>
      ),
    },
    {
      key: "date",
      header: t("orders.columns.date"),
      className: "hidden md:table-cell",
      cell: (order) => (
        <time
          dateTime={order.created_at}
          title={formatDateTime(order.created_at)}
          className="text-muted-foreground"
        >
          {formatRelative(order.created_at)}
        </time>
      ),
    },
    {
      key: "customer",
      header: t("orders.columns.customer"),
      cell: (order) => <CustomerCell customer={order.customer} />,
    },
    {
      key: "stage",
      header: t("orders.columns.stage"),
      // On phones the total sits under the stage; its own column comes back from sm up
      cell: (order) => (
        <div className="flex flex-col items-start gap-1">
          <StageBadge stage={order.stage} />
          <span className="tabular text-xs font-medium sm:hidden">
            {formatMoney(order.total, order.currency_code)}
          </span>
        </div>
      ),
    },
    {
      key: "items",
      header: t("orders.columns.items"),
      className: "hidden lg:table-cell",
      cell: (order) => (
        <span className="text-muted-foreground">
          {t("orders.itemsCount", { count: order.items })}
        </span>
      ),
    },
    {
      key: "total",
      header: t("orders.columns.total"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (order) => (
        <span className="tabular font-medium">{formatMoney(order.total, order.currency_code)}</span>
      ),
    },
  ]
}

/** Every order by stage (docs/06 §4): what needs packing first, then the rest. */
export function OrdersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const stage = search.stage ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const board = useQuery(orderBoardQuery({ stage, q, page }))
  const columns = useColumns()
  const setSearch = (next: { q?: string; stage?: OrderStage; page?: number }) => {
    const nextStage = next.stage ?? stage
    void navigate({
      to: "/orders",
      search: {
        q: (next.q ?? q) || undefined,
        stage: nextStage === "all" ? undefined : nextStage,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.orders")}
        description={t("orders.description")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/orders/chargebacks">{t("orders.chargeback.queue")}</Link>
          </Button>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("orders.views")}
          value={stage}
          onChange={(next) => {
            setSearch({ stage: next, page: 1 })
          }}
          tabs={ORDER_STAGES.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`stage.${key}`),
            count: board.data?.counts[key],
          }))}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("orders.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {board.data?.limited ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" aria-hidden="true" />
              {t("orders.limited")}
            </p>
          ) : null}
        </div>
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
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {q
                      ? t("orders.noMatch")
                      : stage === "all"
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
    </div>
  )
}
