import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Mails, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BULK_PAGE_SIZE, bulkMessagesQuery } from "@/features/bulk-messages/api/bulk-messages"
import { BULK_CHANNELS, BULK_STATUSES } from "@/features/bulk-messages/api/types"
import type { BulkChannel, BulkStatus } from "@/features/bulk-messages/api/types"
import { useBulkColumns } from "@/features/bulk-messages/components/bulk-columns"
import { BulkGate } from "@/features/bulk-messages/components/bulk-gate"
import { useBulkAccess } from "@/features/bulk-messages/components/use-bulk-access"
import { NewBulkMessageDialog } from "@/features/bulk-messages/components/new-bulk-message-dialog"
import type { BulkMessageSearch } from "@/features/bulk-messages/search"
import { errorText } from "@/lib/errors"

const B = "bulkMessages"
const route = getRouteApi("/_auth/bulk-messages/")

type StatusView = BulkStatus | "all"
type ChannelView = BulkChannel | "all"

/** The campaigns, newest first: the state and the channel filtered by the server. */
function BulkList({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = route.useSearch()
  const status: StatusView = search.status ?? "all"
  const channel: ChannelView = search.channel ?? "all"
  const page = (search.page ?? 1) - 1
  const list = useQuery(
    bulkMessagesQuery({
      status: status === "all" ? null : status,
      channel: channel === "all" ? null : channel,
      page,
    })
  )
  const columns = useBulkColumns()
  const setSearch = (next: { status?: StatusView; channel?: ChannelView; page?: number }) => {
    const nextStatus = next.status ?? status
    const nextChannel = next.channel ?? channel
    const query: BulkMessageSearch = {
      status: nextStatus === "all" ? undefined : nextStatus,
      channel: nextChannel === "all" ? undefined : nextChannel,
      page: next.page && next.page > 1 ? next.page : undefined,
    }
    void navigate({ to: "/bulk-messages", search: query, replace: true })
  }
  const filtered = status !== "all" || channel !== "all"
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 border-b pr-3">
        {/* The tabs' own line gives way to the row's */}
        <div className="min-w-0 flex-1 [&>[role=tablist]]:border-b-0">
          <FilterTabs
            label={t(`${B}.views`)}
            value={status}
            onChange={(next) => {
              setSearch({ status: next, page: 1 })
            }}
            tabs={(["all", ...BULK_STATUSES] as const).map((key) => ({
              key,
              label: key === "all" ? t(`${B}.allStatuses`) : t(`${B}.status.${key}`),
            }))}
          />
        </div>
        <Select
          value={channel}
          onValueChange={(next) => {
            setSearch({ channel: next as ChannelView, page: 1 })
          }}
        >
          <SelectTrigger size="sm" className="w-40" aria-label={t(`${B}.channelFilter`)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(`${B}.allChannels`)}</SelectItem>
            {BULK_CHANNELS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`${B}.channels.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={list.data?.campaigns}
            rowKey={(row) => row.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(row) => {
              void navigate({ to: "/bulk-messages/$id", params: { id: row.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Mails className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {t(filtered ? `${B}.emptyFiltered` : `${B}.empty`)}
                </p>
                {filtered ? null : (
                  <Button onClick={onNew}>
                    <Plus />
                    {t(`${B}.new`)}
                  </Button>
                )}
              </div>
            }
          />
          {list.data && list.data.count > BULK_PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={BULK_PAGE_SIZE}
              count={list.data.count}
              onPageChange={(next) => {
                setSearch({ page: next + 1 })
              }}
            />
          ) : null}
        </>
      )}
    </section>
  )
}

/** Büyüme > Toplu ileti (adr/0050 §10): bulk e-mail and SMS to consented customers. */
export function BulkMessagesPage() {
  const { t } = useTranslation()
  const gate = useBulkAccess()
  const [creating, setCreating] = useState(false)
  const open = () => {
    setCreating(true)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${B}.title`)}
        description={t(`${B}.description`)}
        action={
          gate.access === "ok" ? (
            <Button onClick={open}>
              <Plus />
              {t(`${B}.new`)}
            </Button>
          ) : null
        }
      />
      <BulkGate gate={gate}>
        <BulkList onNew={open} />
        <NewBulkMessageDialog open={creating} onOpenChange={setCreating} />
      </BulkGate>
    </div>
  )
}
