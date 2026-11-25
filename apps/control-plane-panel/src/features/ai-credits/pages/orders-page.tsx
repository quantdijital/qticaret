import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AI_CREDIT_ORDER_STATUSES } from "@qticaret/types/control-plane"
import type { AiCreditOrderStatus } from "@qticaret/types/control-plane"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { money } from "@/features/billing/words"
import { ORDERS_PAGE_SIZE, ordersQuery, shopNamesQuery } from "@/features/ai-credits/api/queries"
import type { AiOrder } from "@/features/ai-credits/api/schemas"
import { CancelDialog, PaidDialog } from "@/features/ai-credits/components/order-dialogs"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_app/ai-orders")

type Open = { order: AiOrder; action: "paid" | "cancel" } | null

/**
 * Kredi talepleri (adr/0085 K11; the owner's alone): every shop's top-up
 * requests by status, newest first. A pending one is marked paid (its
 * pack's credits added) or cancelled, each asked first and behind a
 * step-up; the list and the shop's wallet are read again after.
 */
export function OrdersPage() {
  const { t } = useTranslation()
  const { status, page } = route.useSearch()
  const navigate = useNavigate({ from: "/ai-orders" })
  const list = useQuery(ordersQuery(status, page - 1))
  const names = useQuery(shopNamesQuery())
  const [open, setOpen] = useState<Open>(null)
  const go = (next: Partial<{ status: AiCreditOrderStatus; page: number }>) => {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...next }) })
  }
  const shopOf = (order: AiOrder) => names.data?.get(order.tenant_id) ?? order.tenant_id
  const pending = status === "pending"
  const columns: Column<AiOrder>[] = [
    {
      key: "shop",
      header: t("aiCredits.orders.columns.shop"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/tenants/$id"
            params={{ id: row.tenant_id }}
            search={{ part: "ai-credits" }}
            className="truncate font-medium hover:underline"
          >
            {shopOf(row)}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {row.pack.name} · {formatDate(row.requested_at)}
          </span>
        </div>
      ),
    },
    {
      key: "credits",
      header: t("aiCredits.orders.columns.credits"),
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      cell: (row) => formatCount(row.pack.credits),
    },
    {
      key: "amount",
      header: t("aiCredits.orders.columns.amount"),
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      cell: (row) => money(row.pack.amount, row.pack.currency),
    },
    {
      key: "day",
      header: t(
        pending ? "aiCredits.orders.columns.requested" : "aiCredits.orders.columns.decided"
      ),
      className: "hidden lg:table-cell whitespace-nowrap",
      cell: (row) => formatDate(pending ? row.requested_at : (row.decided_at ?? row.requested_at)),
    },
    ...(pending
      ? [
          {
            key: "actions",
            header: t("aiCredits.orders.columns.actions"),
            cell: (row: AiOrder) => (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen({ order: row, action: "paid" })
                  }}
                >
                  {t("aiCredits.orders.paid.open")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    setOpen({ order: row, action: "cancel" })
                  }}
                >
                  {t("aiCredits.orders.cancel.open")}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]
  const close = () => {
    setOpen(null)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("aiCredits.orders.title")} description={t("aiCredits.orders.text")} />
      {list.isError ? (
        <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <SectionCard title={t("aiCredits.orders.list")} flush>
          <FilterTabs<AiCreditOrderStatus>
            label={t("aiCredits.orders.tabsLabel")}
            value={status}
            onChange={(next) => {
              go({ status: next })
            }}
            tabs={AI_CREDIT_ORDER_STATUSES.map((each) => ({
              key: each,
              label: t(`aiCredits.orders.statuses.${each}`),
            }))}
          />
          <DataTable
            columns={columns}
            rows={list.data?.orders}
            rowKey={(row) => row.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            empty={t(`aiCredits.orders.empty.${status}`)}
          />
          <Pagination
            page={page - 1}
            pageSize={ORDERS_PAGE_SIZE}
            count={list.data?.count ?? 0}
            onPageChange={(next) => {
              go({ page: next + 1 })
            }}
          />
        </SectionCard>
      )}
      {open?.action === "paid" ? (
        <PaidDialog order={open.order} shop={shopOf(open.order)} onClose={close} />
      ) : null}
      {open?.action === "cancel" ? (
        <CancelDialog order={open.order} shop={shopOf(open.order)} onClose={close} />
      ) : null}
    </div>
  )
}
