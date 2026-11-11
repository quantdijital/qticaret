import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { PAYMENT_VIEWS, PAYMENTS_PAGE_SIZE, paymentsQuery } from "@/features/billing/api"
import type { PaymentRow, PaymentView } from "@/features/billing/api"
import { chargeWord, money, periodText } from "@/features/billing/words"
import { errorText } from "@/lib/errors"
import { InstructionCard } from "../components/instruction-card"

const route = getRouteApi("/_app/payments")

/**
 * Ödemeler (adr/0061 §7 "üst panelde yaklaşan / geciken listesi", Ek C16):
 * upcoming, overdue and paid charges in tabs with their counts, the
 * list's total, by a shop's name or address; a row opens the shop's
 * Abonelik tab, where the actions are. Beside it, the payment instruction
 * every shop shows.
 */
export function PaymentsPage() {
  const { t } = useTranslation()
  const { view, q, page } = route.useSearch()
  const navigate = useNavigate({ from: "/payments" })
  const list = useQuery(paymentsQuery({ view, q, page: page - 1 }))
  const go = (next: Partial<{ view: PaymentView; q: string; page: number }>) => {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...next }) })
  }
  const open = (row: PaymentRow) => {
    void navigate({
      to: "/tenants/$id",
      params: { id: row.tenant.id },
      search: { part: "subscription" },
    })
  }
  const paid = view === "paid"
  const columns: Column<PaymentRow>[] = [
    {
      key: "shop",
      header: t("billing.payments.columns.shop"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/tenants/$id"
            params={{ id: row.tenant.id }}
            search={{ part: "subscription" }}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {row.tenant.name ?? row.tenant.id}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {periodText(row.period_start, row.period_end)}
          </span>
        </div>
      ),
    },
    {
      key: "day",
      header: t(paid ? "billing.payments.columns.paidOn" : "billing.payments.columns.due"),
      cell: (row) => formatDate(paid ? (row.paid_on ?? row.due_on) : row.due_on),
    },
    {
      key: "amount",
      header: t("billing.payments.columns.amount"),
      align: "right",
      cell: (row) => money(row.amount, row.currency_code),
    },
    {
      key: "status",
      header: t("billing.payments.columns.status"),
      cell: (row) => {
        const word = chargeWord(t, row)
        return <StatusBadge tone={word.tone}>{word.label}</StatusBadge>
      },
    },
    {
      key: "detail",
      header: t(paid ? "billing.payments.columns.method" : "billing.payments.columns.graceEnds"),
      className: "hidden lg:table-cell",
      cell: (row) =>
        paid
          ? row.method
            ? t(`billing.method.${row.method}`)
            : "—"
          : formatDate(row.grace_ends_on),
    },
  ]
  const counts = list.data?.counts
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("billing.payments.title")} description={t("billing.payments.text")} />
      <PageGrid>
        <PageColumn span={8}>
          {list.isError ? (
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          ) : (
            <SectionCard title={t("billing.payments.list")} flush className="h-full">
              <FilterTabs<PaymentView>
                label={t("billing.payments.tabsLabel")}
                value={view}
                onChange={(next) => {
                  go({ view: next })
                }}
                tabs={PAYMENT_VIEWS.map((each) => ({
                  key: each,
                  label: t(`billing.payments.views.${each}`),
                  count: counts?.[each],
                }))}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                <SearchInput
                  value={q}
                  onChange={(next) => {
                    go({ q: next })
                  }}
                  placeholder={t("billing.payments.search")}
                  className="sm:max-w-sm"
                />
                {list.data ? (
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {t("billing.payments.total", {
                      count: list.data.count,
                      amount: money(list.data.total),
                    })}
                  </p>
                ) : null}
              </div>
              <DataTable
                columns={columns}
                rows={list.data?.payments}
                rowKey={(row) => row.id}
                onRowClick={open}
                loading={list.isPending}
                stale={list.isPlaceholderData}
                empty={t(q ? "billing.payments.emptySearch" : `billing.payments.empty.${view}`)}
              />
              <Pagination
                page={page - 1}
                pageSize={PAYMENTS_PAGE_SIZE}
                count={list.data?.count ?? 0}
                onPageChange={(next) => {
                  go({ page: next + 1 })
                }}
              />
            </SectionCard>
          )}
        </PageColumn>
        <PageColumn span={4}>
          <InstructionCard className="h-full" />
        </PageColumn>
      </PageGrid>
    </div>
  )
}
