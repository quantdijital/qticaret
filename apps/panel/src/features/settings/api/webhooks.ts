import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The events a subscription can take (F11.7); their texts under `settings.api.webhooks.events`. */
export const WEBHOOK_EVENTS = [
  "order.placed",
  "order.canceled",
  "order.fulfilled",
  "return.requested",
  "return.received",
  "stock.changed",
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/** An event's text key: i18next reads `.` as nesting, so `order.placed` is `order_placed`. */
export const eventKey = (event: string) => event.replace(".", "_")

export interface WebhookSubscription {
  id: string
  url: string
  events: WebhookEvent[]
  status: "active" | "disabled"
  failure_streak: number
  disabled_at: string | null
  created_at: string
}

export interface WebhookDelivery {
  id: string
  event: string
  status: "pending" | "delivered" | "stopped"
  attempts: number
  last_status: number | null
  last_duration_ms: number | null
  last_error: string | null
  next_attempt_at: string
  delivered_at: string | null
  created_at: string
}

const KEY = ["webhooks"] as const

export const webhooksQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<{ subscriptions: WebhookSubscription[] }>("/admin/webhooks"),
  })

export const webhookQuery = (id: string) =>
  queryOptions({
    queryKey: [...KEY, id],
    queryFn: () =>
      sdk.client.fetch<{ subscription: WebhookSubscription; deliveries: WebhookDelivery[] }>(
        `/admin/webhooks/${encodeURIComponent(id)}`
      ),
  })

export function useSubscribeWebhook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { url: string; events: WebhookEvent[] }) =>
      sdk.client.fetch<{ subscription: WebhookSubscription; secret: string }>("/admin/webhooks", {
        method: "POST",
        body,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useReactivateWebhook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/webhooks/${encodeURIComponent(id)}`, {
        method: "POST",
        body: { status: "active" },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteWebhook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
