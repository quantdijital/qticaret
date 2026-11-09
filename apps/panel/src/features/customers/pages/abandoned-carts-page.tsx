import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Package, ShoppingCart } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { useRecordWalk } from "@/components/patterns/use-record-walk"
import { ABANDONED_PAGE_SIZE, abandonedCartsQuery } from "@/features/customers/api/abandoned-carts"
import type { AbandonedCart } from "@/features/customers/api/abandoned-carts"
import { AbandonedCartDialog } from "@/features/customers/components/abandoned-cart-dialog"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { ReminderBadge } from "@/features/customers/components/reminder-badge"
import { errorText } from "@/lib/errors"
import { formatMoney, formatRelative } from "@/lib/format"

const route = getRouteApi("/_auth/customers/abandoned-carts")
const C = "customers.abandoned"

function Thumbs({ cart }: { cart: AbandonedCart }) {
  const { t } = useTranslation()
  const [first] = cart.lines
  const more = cart.line_count - 1
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex shrink-0 -space-x-2">
        {cart.lines.map((line, index) =>
          line.thumbnail ? (
            <img
              key={`${line.title}-${String(index)}`}
              src={line.thumbnail}
              alt=""
              className="size-8 rounded-md border-2 border-card object-cover"
            />
          ) : (
            <span
              key={`${line.title}-${String(index)}`}
              className="flex size-8 items-center justify-center rounded-md border-2 border-card bg-muted"
            >
              <Package className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
          )
        )}
      </div>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">
          {first ? t(`${C}.lineSummary`, { title: first.title, count: first.quantity }) : "—"}
        </span>
        {more > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t(`${C}.moreLines`, { count: more })}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function useColumns(onOpen: (cart: AbandonedCart) => void): Column<AbandonedCart>[] {
  const { t } = useTranslation()
  return [
    {
      key: "customer",
      header: t(`${C}.columns.customer`),
      cell: (cart) => (
        <div className="flex max-w-60 min-w-0 flex-col items-start">
          {/* The row opens the cart; this is its keyboard way in */}
          <button
            type="button"
            className="max-w-full truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(cart)
            }}
          >
            {cart.name ?? cart.email ?? cart.phone_masked ?? t(`${C}.unnamed`)}
          </button>
          <span className="max-w-full truncate text-xs text-muted-foreground">
            {cart.name ? (cart.email ?? cart.phone_masked) : cart.email ? cart.phone_masked : null}
          </span>
        </div>
      ),
    },
    {
      key: "lines",
      header: t(`${C}.columns.lines`),
      className: "hidden md:table-cell",
      cell: (cart) => <Thumbs cart={cart} />,
    },
    {
      key: "total",
      header: t(`${C}.columns.total`),
      align: "right",
      cell: (cart) => (
        <span className="font-medium tabular-nums">
          {formatMoney(cart.total, cart.currency_code)}
        </span>
      ),
    },
    {
      key: "activity",
      header: t(`${C}.columns.activity`),
      className: "hidden sm:table-cell",
      cell: (cart) => (
        <span className="text-muted-foreground">{formatRelative(cart.updated_at)}</span>
      ),
    },
    {
      key: "reminder",
      header: t(`${C}.columns.reminder`),
      cell: (cart) => (
        <div className="flex flex-col items-start gap-1">
          <ReminderBadge reminder={cart.reminder} />
          <span className="text-xs text-muted-foreground">
            {t(cart.consent.email === "granted" ? `${C}.consent.emailYes` : `${C}.consent.emailNo`)}
          </span>
        </div>
      ),
    },
  ]
}

/**
 * Müşteriler > Terk edilen sepetler (2026-11-06): carts with a way to
 * reach their shopper, left over an hour and within 30 days, newest
 * activity first. A row opens the cart in the standard window, where it
 * may be reminded within the shopper's consent.
 */
export function AbandonedCartsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const page = (search.page ?? 1) - 1
  const list = useQuery(abandonedCartsQuery(page))
  const walk = useRecordWalk(list.data?.carts, (cart) => cart.id)
  const columns = useColumns(walk.show)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${C}.title`)} description={t(`${C}.description`)} />
      <CustomersNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.carts}
              rowKey={(cart) => cart.id}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              onRowClick={walk.show}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <ShoppingCart className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t(`${C}.empty`)}</p>
                </div>
              }
            />
            {list.data && list.data.count > ABANDONED_PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={ABANDONED_PAGE_SIZE}
                count={list.data.count}
                onPageChange={(next) => {
                  void navigate({
                    to: "/customers/abandoned-carts",
                    search: { page: next > 0 ? next + 1 : undefined },
                    replace: true,
                  })
                }}
              />
            ) : null}
          </>
        )}
      </section>
      <AbandonedCartDialog cartId={walk.open?.id ?? null} steps={walk.steps} onClose={walk.close} />
    </div>
  )
}
