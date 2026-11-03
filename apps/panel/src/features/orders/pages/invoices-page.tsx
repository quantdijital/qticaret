import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import {
  ADVANCE_ONLY,
  INVOICE_PAGE_SIZE,
  INVOICE_STATUSES,
  advanceOf,
  invoicesQuery,
} from "@/features/orders/api/invoices"
import type { InvoiceRecord, InvoiceStatus } from "@/features/orders/api/invoices"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@/lib/format"

const V = "orders.invoice"
const route = getRouteApi("/_auth/orders/invoices")
type View = InvoiceStatus | "all"
const VIEWS: readonly View[] = [...INVOICE_STATUSES, "all"]

const TONE: Record<InvoiceStatus, StatusTone> = {
  failed: "danger",
  pending: "info",
  issuing: "info",
  issued: "success",
  cancelled: "neutral",
  waived: "neutral",
}

/**
 * Orders > Invoices (F8, adr/0034): the shop's invoices by where they
 * stand, the stopped ones first, each a click from its order.
 */
export function InvoicesPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const view: View = search.view ?? "failed"
  const page = (search.page ?? 1) - 1
  const query = useQuery(
    invoicesQuery({
      ...(view === "all" ? {} : { status: view }),
      offset: page * INVOICE_PAGE_SIZE,
      limit: INVOICE_PAGE_SIZE,
    })
  )
  const setSearch = (next: { view?: View; page?: number }) => {
    const nextView = next.view ?? view
    void navigate({
      to: "/orders/invoices",
      search: {
        view: nextView === "failed" ? undefined : nextView,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const columns: Column<InvoiceRecord>[] = [
    {
      key: "order",
      header: t(`${V}.columns.order`),
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
      key: "status",
      header: t(`${V}.columns.status`),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge tone={TONE[row.status]}>{t(`${V}.status.${row.status}`)}</StatusBadge>
          {/* Gift cards alone: no invoice, an advance (adr/0025 Ek 2026-11-03) */}
          {row.status === "waived" && row.waived_reason === ADVANCE_ONLY ? (
            <span className="text-xs text-muted-foreground">{t(`${V}.advanceOnly`)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "number",
      header: t(`${V}.number`),
      className: "hidden md:table-cell",
      cell: (row) => <span className="font-mono text-xs">{row.number ?? "—"}</span>,
    },
    {
      key: "program",
      header: t(`${V}.columns.program`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">
          {t(`${V}.providers.${row.provider}`, { defaultValue: "—" })}
          {row.document_type ? ` · ${t(`${V}.types.${row.document_type}`)}` : ""}
        </span>
      ),
    },
    {
      key: "when",
      header: t(`${V}.columns.when`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.issued_at ?? row.created_at)}
        </span>
      ),
    },
    {
      key: "total",
      header: t(`${V}.columns.total`),
      align: "right",
      cell: (row) => {
        const advance = advanceOf(row)
        return (
          <span className="flex flex-col items-end gap-0.5">
            {formatMoney(row.total, "try")}
            {advance ? (
              <span className="text-xs text-muted-foreground">
                {t(`${V}.advanceAmount`, { amount: formatMoney(advance, "try") })}
              </span>
            ) : null}
          </span>
        )
      },
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/orders", label: t("nav.orders") }}
        title={t(`${V}.queue`)}
        description={t(`${V}.queueDescription`)}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${V}.queue`)}
          value={view}
          onChange={(next) => {
            setSearch({ view: next, page: 1 })
          }}
          tabs={VIEWS.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`${V}.status.${key}`),
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
              rows={query.data?.invoices ?? []}
              rowKey={(row) => row.id}
              loading={!query.data}
              empty={t(`${V}.empty`)}
            />
            {query.data && query.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={INVOICE_PAGE_SIZE}
                count={query.data.count}
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
