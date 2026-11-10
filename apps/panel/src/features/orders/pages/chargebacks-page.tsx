import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { EllipsisVertical } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import {
  CHARGEBACK_PAGE_SIZE,
  NEXT_STATUS,
  chargebacksQuery,
  evidenceUrl,
  useMoveChargeback,
} from "@/features/orders/api/chargebacks"
import type { Chargeback, ChargebackStatus } from "@/features/orders/api/chargebacks"
import { Fact, QueueDialog } from "@/features/orders/components/queue-dialog"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"

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

/** A dispute opened from the queue: its facts, its evidence and its next step. */
function ChargebackDialog({
  chargeback,
  onClose,
}: {
  chargeback: Chargeback | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <QueueDialog
      open={chargeback !== null}
      onClose={onClose}
      title={t(`${C}.dialogTitle`, { number: chargeback?.order_display_id ?? "—" })}
      orderId={chargeback?.order_id ?? null}
    >
      {chargeback ? (
        <div className="flex flex-col gap-4">
          <dl>
            <Fact label={t(`${C}.columns.status`)}>
              <StatusBadge tone={TONE[chargeback.status]}>
                {t(`${C}.status.${chargeback.status}`)}
              </StatusBadge>
            </Fact>
            <Fact label={t(`${C}.reason`)}>{t(`${C}.reasons.${chargeback.reason}`)}</Fact>
            <Fact label={t(`${C}.columns.amount`)}>
              {formatMoney(chargeback.amount, chargeback.currency_code)}
            </Fact>
            <Fact label={t(`${C}.due`)}>
              {chargeback.due_at ? formatDateTime(chargeback.due_at) : "—"}
            </Fact>
            <Fact label={t(`${C}.openedAt`)}>{formatDateTime(chargeback.created_at)}</Fact>
            {chargeback.provider_reference ? (
              <Fact label={t(`${C}.reference`)}>{chargeback.provider_reference}</Fact>
            ) : null}
          </dl>
          {chargeback.note ? (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{chargeback.note}</p>
          ) : null}
          <Actions chargeback={chargeback} />
        </div>
      ) : null}
    </QueueDialog>
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
  // The row opened in its dialog, by id: the list's fresh copy after a move
  const [openId, setOpenId] = useState<string | null>(null)
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
          onClick={(event) => {
            event.stopPropagation()
          }}
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
    {
      key: "actions",
      header: "",
      align: "right",
      // The row opens the dispute; its buttons only act
      cell: (row) => (
        <span
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <Actions chargeback={row} />
        </span>
      ),
    },
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
              onRowClick={(row) => {
                setOpenId(row.id)
              }}
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
      <ChargebackDialog
        chargeback={(query.data?.chargebacks ?? []).find((row) => row.id === openId) ?? null}
        onClose={() => {
          setOpenId(null)
        }}
      />
    </div>
  )
}
