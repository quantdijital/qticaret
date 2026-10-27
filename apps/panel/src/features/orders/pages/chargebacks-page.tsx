import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { EllipsisVertical } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CHARGEBACK_PAGE_SIZE,
  NEXT_STATUS,
  chargebacksQuery,
  evidenceUrl,
  useMoveChargeback,
} from "@/features/orders/api/chargebacks"
import type { Chargeback, ChargebackStatus } from "@/features/orders/api/chargebacks"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@/lib/format"

const C = "orders.chargeback"
const route = getRouteApi("/_auth/orders/chargebacks")
type View = ChargebackStatus | "all"
const VIEWS: readonly View[] = ["open", "evidence_submitted", "won", "lost", "all"]

const TONE: Record<ChargebackStatus, StatusTone> = {
  open: "danger",
  evidence_submitted: "warning",
  won: "success",
  lost: "neutral",
}

function Actions({ chargeback }: { chargeback: Chargeback }) {
  const { t } = useTranslation()
  const move = useMoveChargeback()
  const next = NEXT_STATUS[chargeback.status]
  return (
    <span className="flex justify-end gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={evidenceUrl(chargeback.id)} download>
          {t(`${C}.evidence`)}
        </a>
      </Button>
      {next.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              aria-label={t(`${C}.move`)}
              disabled={move.isPending}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {next.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => {
                  move.mutate(
                    { id: chargeback.id, status },
                    {
                      onSuccess: () =>
                        toast.success(t(`${C}.moved`, { status: t(`${C}.status.${status}`) })),
                      onError: (failure) => toast.error(errorText(t, failure)),
                    }
                  )
                }}
              >
                {t(`${C}.markAs`, { status: t(`${C}.status.${status}`) })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </span>
  )
}

/**
 * Orders > Chargebacks (F6.7, adr/0030): the disputes, the nearest deadline
 * first, each with its evidence in one click and its next step.
 */
export function ChargebacksPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const view: View = search.view ?? "open"
  const page = (search.page ?? 1) - 1
  const query = useQuery(chargebacksQuery(view === "all" ? { page } : { status: view, page }))
  const setSearch = (next: { view?: View; page?: number }) => {
    const nextView = next.view ?? view
    void navigate({
      to: "/orders/chargebacks",
      search: {
        view: nextView === "open" ? undefined : nextView,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const columns: Column<Chargeback>[] = [
    {
      key: "order",
      header: t(`${C}.columns.order`),
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
      key: "reason",
      header: t(`${C}.reason`),
      className: "hidden md:table-cell",
      cell: (row) => t(`${C}.reasons.${row.reason}`),
    },
    {
      key: "status",
      header: t(`${C}.columns.status`),
      cell: (row) => (
        <StatusBadge tone={TONE[row.status]}>{t(`${C}.status.${row.status}`)}</StatusBadge>
      ),
    },
    {
      key: "due",
      header: t(`${C}.due`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.due_at ? formatDateTime(row.due_at) : "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: t(`${C}.columns.amount`),
      align: "right",
      cell: (row) => formatMoney(row.amount, row.currency_code),
    },
    { key: "actions", header: "", align: "right", cell: (row) => <Actions chargeback={row} /> },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/orders", label: t("nav.orders") }}
        title={t(`${C}.queue`)}
        description={t(`${C}.queueDescription`)}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${C}.queue`)}
          value={view}
          onChange={(next) => {
            setSearch({ view: next, page: 1 })
          }}
          tabs={VIEWS.map((key) => ({
            key,
            label: key === "all" ? t("orders.tabs.all") : t(`${C}.status.${key}`),
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
              rows={query.data?.chargebacks ?? []}
              rowKey={(row) => row.id}
              loading={!query.data}
              empty={t(`${C}.empty`)}
            />
            {query.data && query.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={CHARGEBACK_PAGE_SIZE}
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
