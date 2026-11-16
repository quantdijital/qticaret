import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { BellOff, Check } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { AlertItem } from "@/features/notifications/alert-item"
import {
  ALERTS_PAGE_SIZE,
  ALERT_GROUPS,
  alertsQuery,
  useMarkRead,
} from "@/features/notifications/api"
import type { AdminNotification, AlertGroup, AlertState } from "@/features/notifications/api"
import type { NotificationSearch } from "@/features/notifications/search"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/notifications")
const N = "notifications.page"
// Radix's Select takes no empty value: "every kind" is this
const EVERY = "all"

/**
 * Bildirimler (adr/0020): every alert the bell shows the newest of, in
 * pages; read or unread, by kind; each opened from its row (which reads
 * it), read one by one, the chosen ones, or all at once. What is read is
 * this person's own.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const state: AlertState = search.state ?? "all"
  const group: AlertGroup | null = search.group ?? null
  const page = (search.page ?? 1) - 1
  const list = useQuery(alertsQuery({ state, group, page }))
  const mark = useMarkRead()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const rows = list.data?.notifications ?? []
  const unread = list.data?.unread ?? 0

  const setSearch = (next: NotificationSearch) => {
    const merged = { state: search.state, group: search.group, page: search.page, ...next }
    setSelected(new Set())
    void navigate({
      to: "/notifications",
      search: {
        state: merged.state === "all" ? undefined : merged.state,
        group: merged.group,
        page: merged.page && merged.page > 1 ? merged.page : undefined,
      },
      replace: true,
    })
  }
  const markRead = (target: { ids: string[] } | { all: true }) => {
    mark.mutate(target, {
      onSuccess: () => {
        setSelected(new Set())
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const opened = (notification: AdminNotification) => {
    if (!notification.read) {
      mark.mutate({ ids: [notification.id] })
    }
  }
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) {
      next.add(id)
    } else {
      next.delete(id)
    }
    setSelected(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.title")}
        description={t(`${N}.description`)}
        action={
          <Button
            variant="outline"
            disabled={unread === 0 || mark.isPending}
            onClick={() => {
              markRead({ all: true })
            }}
          >
            <Check />
            {t("notifications.markAllRead")}
          </Button>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${N}.views`)}
          value={state}
          onChange={(next) => {
            setSearch({ state: next, page: 1 })
          }}
          tabs={[
            { key: "all", label: t(`${N}.tabs.all`) },
            { key: "unread", label: t(`${N}.tabs.unread`), count: unread },
            { key: "read", label: t(`${N}.tabs.read`) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <Select
            value={group ?? EVERY}
            onValueChange={(next) => {
              setSearch({ group: next === EVERY ? undefined : (next as AlertGroup), page: 1 })
            }}
          >
            <SelectTrigger aria-label={t(`${N}.group`)} className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERY}>{t(`${N}.groups.all`)}</SelectItem>
              {ALERT_GROUPS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`${N}.groups.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected.size > 0 ? (
          <div
            role="region"
            aria-label={t(`${N}.bulk`)}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/60 px-5 py-2.5 text-sm"
          >
            <span className="font-medium" aria-live="polite">
              {t(`${N}.selected`, { count: selected.size, formatted: formatCount(selected.size) })}
            </span>
            <Button
              size="sm"
              disabled={mark.isPending}
              onClick={() => {
                markRead({ ids: [...selected] })
              }}
            >
              {t(`${N}.markSelected`)}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0 text-foreground underline"
              onClick={() => {
                setSelected(new Set())
              }}
            >
              {t(`${N}.clear`)}
            </Button>
          </div>
        ) : null}
        {list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : list.isPending ? (
          <div className="px-5 pb-5">
            <LoadingRows rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t px-5 py-12 text-center">
            <BellOff className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {state === "all" && !group ? t("notifications.empty") : t(`${N}.noMatch`)}
            </p>
          </div>
        ) : (
          <ul
            className={cn("divide-y border-t", list.isPlaceholderData && "opacity-60")}
            aria-label={t("notifications.title")}
          >
            {rows.map((notification) => (
              <AlertItem
                key={notification.id}
                notification={notification}
                onOpen={opened}
                leading={
                  <Checkbox
                    className="mt-2"
                    aria-label={t(`${N}.select`)}
                    checked={selected.has(notification.id)}
                    onCheckedChange={(checked) => {
                      toggle(notification.id, checked === true)
                    }}
                  />
                }
                trailing={
                  notification.read ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={mark.isPending}
                      onClick={() => {
                        markRead({ ids: [notification.id] })
                      }}
                    >
                      {t(`${N}.markOne`)}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        )}
        {list.data && list.data.count > 0 ? (
          <Pagination
            page={page}
            pageSize={ALERTS_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </section>
    </div>
  )
}
