import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Info, Inbox } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ORDER_PAGE_SIZE,
  ORDER_STAGES,
  PAYMENT_FILTERS,
  SHIPPING_FILTERS,
  orderBoardQuery,
} from "@/features/orders/api/orders"
import type { BoardOrder } from "@/features/orders/api/orders"
import type { ShipResult } from "@/features/orders/api/shipping"
import { BulkBar } from "@/features/orders/components/bulk-bar"
import { useColumns } from "@/features/orders/components/order-columns"
import { ShipResultsDialog } from "@/features/orders/components/ship-results-dialog"
import type { OrderListSearch } from "@/features/orders/search"
import { PaymentLinkButtons } from "@/features/payment-links/components/order-buttons"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/orders/")
const ANY = "__any"

/** A filter beside the search: its choices, "any" first. */
function FilterSelect<T extends string>({
  label,
  value,
  options,
  text,
  onChange,
}: {
  label: string
  value: T | undefined
  options: readonly T[]
  text: (option: T) => string
  onChange: (next: T | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => {
        onChange(next === ANY ? undefined : (next as T))
      }}
    >
      <SelectTrigger className="w-full sm:w-80" aria-label={label}>
        {/* The chosen value with what it filters: "Kargo: Yolda" */}
        <SelectValue>
          {value ? `${label}: ${text(value)}` : t("orders.filters.any", { what: label })}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t("orders.filters.any", { what: label })}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {text(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Every order by stage (docs/06 §4): what needs packing first, then the rest. */
export function OrdersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const stage = search.stage ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const { payment, shipping } = search
  const board = useQuery(orderBoardQuery({ stage, q, page, payment, shipping }))
  const columns = useColumns()
  // Orders picked to ship at once (F7.7), kept with their row for the results' numbers
  const [picked, setPicked] = useState<Map<string, BoardOrder>>(new Map())
  const [results, setResults] = useState<{
    list: ShipResult[]
    orders: Map<string, BoardOrder>
  } | null>(null)
  const setSearch = (next: OrderListSearch) => {
    const merged = { ...search, ...next }
    void navigate({
      to: "/orders",
      search: {
        q: merged.q === "" ? undefined : merged.q,
        stage: merged.stage === "all" ? undefined : merged.stage,
        payment: merged.payment,
        shipping: merged.shipping,
        page: merged.page && merged.page > 1 ? merged.page : undefined,
      },
      replace: true,
    })
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
            {/* adr/0051: staff-made orders paid through a link, while the shop has them on */}
            <PaymentLinkButtons />
          </span>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("orders.views")}
          value={stage}
          onChange={(next) => {
            refilter({ stage: next })
          }}
          tabs={ORDER_STAGES.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`stage.${key}`),
            count: board.data?.counts[key],
          }))}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            className="sm:w-80 sm:max-w-none"
            value={q}
            placeholder={t("orders.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          <FilterSelect
            label={t("orders.filters.payment")}
            value={payment}
            options={PAYMENT_FILTERS}
            text={(option) => t(`orders.filters.payments.${option}`)}
            onChange={(next) => {
              refilter({ payment: next })
            }}
          />
          <FilterSelect
            label={t("orders.filters.shipping")}
            value={shipping}
            options={SHIPPING_FILTERS}
            text={(option) => t(`orders.filters.shippings.${option}`)}
            onChange={(next) => {
              refilter({ shipping: next })
            }}
          />
          {board.data?.limited ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" aria-hidden="true" />
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
                    {q || payment || shipping
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
