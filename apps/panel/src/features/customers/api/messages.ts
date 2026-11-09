import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export type MessageState = "sent" | "pending" | "failed" | "skipped"
export type MessageSkipReason =
  "channel_off" | "invalid_recipient" | "suppressed" | "no_consent" | "over_quota"

/** One message to a customer (F12.8): sent, or not sent and why. */
export interface MessageRow {
  id: string
  template: string
  channel: "email" | "sms"
  state: MessageState
  reason: MessageSkipReason | null
  /** Masked: enough to recognise the address, not to use it. */
  to: string | null
  at: string
  /** An order's message staff may send again from its template (2026-11-06). */
  resendable?: boolean
}

/** What a message sent again came to: `sent`, or why not (`suppressed`, `channel_off`...). */
export interface ResendResult {
  channel: "email" | "sms"
  outcome: string
}

/** "Mesajı yeniden gönder": the order's message again, to its current address. */
export const resendOrderMessage = (orderId: string, messageId: string) =>
  sdk.client.fetch<ResendResult>(
    `/admin/orders/${encodeURIComponent(orderId)}/messages/${encodeURIComponent(messageId)}/resend`,
    { method: "POST", body: {} }
  )

export interface MessageHistory {
  messages: MessageRow[]
  /** Only the latest are shown. */
  limited: boolean
}

/** What the order's customer was sent about it, or the customer was sent at all. */
export const messageHistoryQuery = (of: { orderId: string } | { customerId: string }) => {
  const path =
    "orderId" in of
      ? `/admin/orders/${encodeURIComponent(of.orderId)}/messages`
      : `/admin/customers/${encodeURIComponent(of.customerId)}/messages`
  return queryOptions({
    queryKey: ["messages", of],
    queryFn: () => sdk.client.fetch<MessageHistory>(path),
  })
}
