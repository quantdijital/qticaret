import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** An admin alert (Medusa's `feed` channel), read or not by the person signed in. */
export interface AdminNotification {
  id: string
  created_at: string
  data: Record<string, unknown> | null
  read: boolean
}

/** The groups the server filters by (`lib/notifications/feed.ts` `ALERT_GROUPS`). */
export const ALERT_GROUPS = [
  "orders",
  "wholesale",
  "payments",
  "stock",
  "invoices",
  "messages",
  "system",
] as const
export type AlertGroup = (typeof ALERT_GROUPS)[number]

export const ALERT_STATES = ["all", "unread", "read"] as const
export type AlertState = (typeof ALERT_STATES)[number]

export interface AlertPage {
  notifications: AdminNotification[]
  count: number
  /** The person's unread alerts, whatever the filters: the bell's number. */
  unread: number
}

export const ALERTS_KEY = ["notifications"] as const
/** The bell shows the newest ones; the page has the rest. */
export const BELL_SIZE = 20
export const ALERTS_PAGE_SIZE = 25

export interface AlertFilters {
  state: AlertState
  group: AlertGroup | null
  /** 0-based. */
  page: number
}

const fetchAlerts = (query: Record<string, string | number>) =>
  sdk.client.fetch<AlertPage>("/admin/alerts", { query })

/** The bell: the newest alerts and the unread count; alerts come from the server's own work. */
export const bellQuery = () =>
  queryOptions({
    queryKey: [...ALERTS_KEY, "bell"],
    queryFn: () => fetchAlerts({ limit: BELL_SIZE }),
    refetchInterval: 60_000,
  })

/** `GET /admin/alerts`: one page of the person's alerts. */
export const alertsQuery = (filters: AlertFilters) =>
  queryOptions({
    queryKey: [...ALERTS_KEY, "page", filters],
    queryFn: () =>
      fetchAlerts({
        state: filters.state,
        ...(filters.group ? { group: filters.group } : {}),
        offset: filters.page * ALERTS_PAGE_SIZE,
        limit: ALERTS_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

/** Some alerts read (`ids`), or all of them; the bell and the page read again. */
export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (target: { ids: string[] } | { all: true }) =>
      sdk.client.fetch<{ ok: true }>("/admin/alerts/read", { method: "POST", body: target }),
    onSuccess: () => client.invalidateQueries({ queryKey: ALERTS_KEY }),
  })
}
