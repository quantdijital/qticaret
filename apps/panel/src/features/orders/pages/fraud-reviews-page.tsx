import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { useCan } from "@/features/auth/api/staff"
import {
  FRAUD_PAGE_SIZE,
  FRAUD_REVIEW_STATUSES,
  fraudReviewsQuery,
  useDecideReview,
} from "@/features/orders/api/fraud"
import type { FraudReview, FraudReviewStatus } from "@/features/orders/api/fraud"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@/lib/format"

const F = "orders.fraud"
const route = getRouteApi("/_auth/orders/review")

const TONE: Record<FraudReviewStatus, StatusTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
}

function Decide({ review }: { review: FraudReview }) {
  const { t } = useTranslation()
  const decide = useDecideReview()
  const run = (status: "approved" | "rejected") => {
    decide.mutate(
      { id: review.id, status },
      {
        onSuccess: () => toast.success(t(`${F}.${status}`)),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <span className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={decide.isPending}
        onClick={() => {
          run("rejected")
        }}
      >
        {t(`${F}.reject`)}
      </Button>
      <Button
        size="sm"
        disabled={decide.isPending}
        onClick={() => {
          run("approved")
        }}
      >
        {t(`${F}.approve`)}
      </Button>
    </span>
  )
}

/**
 * Orders > Review (F15.6, adr/0044 §3): the orders the fraud rules held,
 * each with its score and the rules that made it. Approved, an order may
 * ship; turned down, it stays held until cancelled from its own page.
 */
export function FraudReviewsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const canDecide = useCan("fraud")
  const view: FraudReviewStatus = search.view ?? "pending"
  const page = (search.page ?? 1) - 1
  const query = useQuery(fraudReviewsQuery({ status: view, page }))
  const setSearch = (next: { view?: FraudReviewStatus; page?: number }) => {
    const nextView = next.view ?? view
    void navigate({
      to: "/orders/review",
      search: {
        view: nextView === "pending" ? undefined : nextView,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const columns: Column<FraudReview>[] = [
    {
      key: "order",
      header: t(`${F}.columns.order`),
      cell: (row) =>
        row.order ? (
          <span className="flex flex-col">
            <Link
              to="/orders/$id"
              params={{ id: row.order.id }}
              className="font-medium hover:underline"
            >
              #{row.order.display_id}
            </Link>
            {/* A phone keeps the row to the number, the score and the decision */}
            <span className="hidden max-w-64 truncate text-xs text-muted-foreground sm:block">
              {row.order.email ?? "—"}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "reasons",
      header: t(`${F}.columns.reasons`),
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.reasons.map((reason) => (
            <StatusBadge key={reason.rule} tone="neutral">
              {t(`${F}.rules.${reason.rule}`)} +{reason.points}
            </StatusBadge>
          ))}
        </span>
      ),
    },
    {
      key: "score",
      header: t(`${F}.columns.score`),
      align: "right",
      cell: (row) => <span className="font-medium tabular-nums">{row.score}</span>,
    },
    {
      key: "total",
      header: t(`${F}.columns.total`),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (row) => (row.order ? formatMoney(row.order.total / 100, "try") : "—"),
    },
    {
      key: "when",
      header: t(`${F}.columns.when`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        row.status === "pending" && canDecide ? (
          <Decide review={row} />
        ) : (
          <StatusBadge tone={TONE[row.status]}>{t(`${F}.status.${row.status}`)}</StatusBadge>
        ),
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/orders", label: t("nav.orders") }}
        title={t(`${F}.queue`)}
        description={t(`${F}.queueDescription`)}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${F}.queue`)}
          value={view}
          onChange={(next) => {
            setSearch({ view: next, page: 1 })
          }}
          tabs={FRAUD_REVIEW_STATUSES.map((key) => ({ key, label: t(`${F}.status.${key}`) }))}
        />
        {query.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={query.data?.reviews ?? []}
              rowKey={(row) => row.id}
              loading={!query.data}
              empty={t(`${F}.empty.${view}`)}
            />
            {query.data && query.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={FRAUD_PAGE_SIZE}
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
