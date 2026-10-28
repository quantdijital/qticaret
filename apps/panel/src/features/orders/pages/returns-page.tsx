import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { RETURN_PAGE_SIZE, returnRequestsQuery } from "@/features/orders/api/returns"
import type { ReturnRequest, ReturnStatus } from "@/features/orders/api/returns"
import { ReturnActions } from "@/features/orders/components/return-actions"
import type { Open } from "@/features/orders/components/return-actions"
import { ApproveExchangeDialog } from "@/features/orders/detail/exchange-dialog"
import { differenceText } from "@/features/orders/exchange-text"
import { ReceiveReturnDialog, RejectReturnDialog } from "@/features/orders/detail/return-dialogs"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@/lib/format"

const R = "orders.returns"
const route = getRouteApi("/_auth/orders/returns")
// The queue's tabs; a cancelled request shows under "all"
type View = Exclude<ReturnStatus, "canceled"> | "all"
const VIEWS: readonly View[] = ["requested", "approved", "received", "refunded", "rejected", "all"]

const TONE: Record<ReturnStatus, StatusTone> = {
  requested: "warning",
  approved: "info",
  received: "info",
  refunded: "success",
  rejected: "neutral",
  canceled: "neutral",
}

/**
 * Orders > Returns (F7.9, adr/0032): shoppers' requests, those waiting for
 * a decision first; approve or turn down, receive what came back (its
 * money goes back), the return label.
 */
export function ReturnsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const view: View = search.view ?? "requested"
  const page = (search.page ?? 1) - 1
  const query = useQuery(returnRequestsQuery(view === "all" ? { page } : { status: view, page }))
  const [open, setOpen] = useState<Open>(null)
  const setSearch = (next: { view?: View; page?: number }) => {
    const nextView = next.view ?? view
    void navigate({
      to: "/orders/returns",
      search: {
        view: nextView === "requested" ? undefined : nextView,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const columns: Column<ReturnRequest>[] = [
    {
      key: "order",
      header: t(`${R}.columns.order`),
      cell: (row) => (
        <Link
          to="/orders/$id"
          params={{ id: row.order_id }}
          className="font-medium hover:underline"
        >
          #{row.order_display_id ?? "—"}
        </Link>
      ),
    },
    {
      key: "date",
      header: t(`${R}.columns.date`),
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: "reason",
      header: t(`${R}.columns.reason`),
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="flex items-center gap-2">
          {t(`${R}.reasons.${row.reason}`)}
          {row.kind === "exchange" ? (
            <StatusBadge tone="info">{t(`${R}.exchange.badge`)}</StatusBadge>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: t(`${R}.columns.status`),
      cell: (row) => (
        <StatusBadge tone={TONE[row.status]}>{t(`${R}.status.${row.status}`)}</StatusBadge>
      ),
    },
    {
      key: "code",
      header: t(`${R}.columns.code`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">{row.return_code ?? "—"}</span>
      ),
    },
    {
      key: "refund",
      header: t(`${R}.columns.refund`),
      align: "right",
      cell: (row) =>
        row.refund_amount
          ? formatMoney(row.refund_amount, "try")
          : row.kind === "exchange"
            ? differenceText(t, row.difference)
            : "—",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => <ReturnActions request={row} onOpen={setOpen} />,
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/orders", label: t("nav.orders") }}
        title={t(`${R}.queue`)}
        description={t(`${R}.queueDescription`)}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${R}.queue`)}
          value={view}
          onChange={(next) => {
            setSearch({ view: next, page: 1 })
          }}
          tabs={VIEWS.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`${R}.status.${key}`),
          }))}
        />
        {query.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={query.data?.return_requests ?? []}
              rowKey={(row) => row.id}
              loading={!query.data}
              empty={t(`${R}.empty`)}
            />
            {query.data && query.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={RETURN_PAGE_SIZE}
                count={query.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
      {open?.kind === "reject" ? (
        <RejectReturnDialog
          request={open.request}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
      {open?.kind === "exchange" ? (
        <ApproveExchangeDialog
          request={open.request}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
      {open?.kind === "receive" ? (
        <ReceiveReturnDialog
          request={open.request}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </div>
  )
}
