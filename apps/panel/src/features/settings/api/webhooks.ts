import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** The events a subscription can take (F11.7); their texts under `settings.api.webhooks.events`. */
export const WEBHOOK_EVENTS = [
  "order.placed",
  "order.canceled",
  "order.fulfilled",
  "return.requested",
  "return.received",
  "stock.changed",
  "invoice.requested",
  "invoice.withdrawn",
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

/**
 * A new address for the shop's events: asked to prove oneself again
 * (adr/0040 §3). Its signing secret comes back once; the mutation holding
 * it leaves the mutation cache as soon as nothing observes it (`gcTime: 0`).
 */
export function useSubscribeWebhook() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: (body: { url: string; events: WebhookEvent[] }) =>
      withReauth((extra) =>
        sdk.client.fetch<{ subscription: WebhookSubscription; secret: string }>("/admin/webhooks", {
          method: "POST",
          body,
          ...extra,
        })
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * A new signing secret, shown once; the old one signs nothing more. The
 * person proves themselves again: whoever holds it signs as the shop. The
 * mutation holding it leaves the mutation cache as soon as nothing
 * observes it (`gcTime: 0`).
 */
export function useRotateWebhookSecret() {
  return useMutation({
    gcTime: 0,
    mutationFn: (id: string) =>
      withReauth((extra) =>
        sdk.client.fetch<{ id: string; secret: string }>(
          `/admin/webhooks/${encodeURIComponent(id)}/rotate-secret`,
          { method: "POST", body: {}, ...extra }
        )
      ),
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
