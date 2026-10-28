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

export interface DnsRecord {
  record: string
  name: string
  type: string
  value: string
  status?: string
  priority?: number
}

export interface SenderDomainView {
  /** Whether e-mail goes through Resend here: only then can a domain be verified. */
  available: boolean
  /** The address the shop's e-mail goes from now. */
  sender: string | null
  domain: {
    name: string
    local_part: string
    status: "not_started" | "pending" | "verified" | "failure" | "temporary_failure"
    records: DnsRecord[]
    checked_at: string | null
    verified_at: string | null
  } | null
  dmarc: DnsRecord
}

const DOMAIN_PATH = "/admin/messaging/sender-domain"

/** The shop's sender domain (F9.6) and the records to publish. */
export const senderDomainQuery = () =>
  queryOptions({
    queryKey: ["messaging", "sender-domain"],
    queryFn: () => sdk.client.fetch<SenderDomainView>(DOMAIN_PATH),
  })

export const addSenderDomain = (body: { name: string; local_part: string }) =>
  sdk.client.fetch<SenderDomainView>(DOMAIN_PATH, { method: "POST", body })

export const checkSenderDomain = () =>
  sdk.client.fetch<SenderDomainView>(`${DOMAIN_PATH}/check`, { method: "POST", body: {} })

export const removeSenderDomain = () =>
  sdk.client.fetch<SenderDomainView>(DOMAIN_PATH, { method: "DELETE" })
