import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export interface Suppression {
  id: string
  channel: "email" | "sms"
  recipient_masked: string
  reason: "bounce" | "complaint" | "manual"
  source: "resend" | "netgsm" | "panel"
  detail: string | null
  created_at: string
}

/** The addresses no message goes to (F9.6), masked, newest first: a recorded read. */
export const suppressionsQuery = (offset: number) =>
  queryOptions({
    queryKey: ["messaging", "suppressions", offset],
    queryFn: () =>
      sdk.client.fetch<{ suppressions: Suppression[]; count: number; limit: number }>(
        "/admin/messaging/suppressions",
        { query: { offset } }
      ),
    placeholderData: keepPreviousData,
  })

export const addSuppression = (body: { channel: "email" | "sms"; address: string }) =>
  sdk.client.fetch<{ id: string; created: boolean }>("/admin/messaging/suppressions", {
    method: "POST",
    body,
  })

export const removeSuppression = (id: string) =>
  sdk.client.fetch<{ id: string }>(`/admin/messaging/suppressions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
