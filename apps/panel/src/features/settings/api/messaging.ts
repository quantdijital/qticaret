import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export interface Suppression {
  id: string
  channel: "email" | "sms"
  recipient_masked: string
  reason: "bounce" | "complaint" | "manual"
  source: "resend" | "netgsm" | "panel" | "smtp"
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

export type DnsRecordState = "found" | "missing" | "unknown"

/** The sender domain's records, read from DNS: a warning only (adr/0036 Ek 2026-11-10). */
export interface SenderDns {
  domain: string
  spf: DnsRecordState
  dkim: DnsRecordState
  dkim_selector: string | null
  dmarc: DnsRecordState
}

export interface SenderDomainView {
  /** Whether the shop's e-mail goes out at all (the platform's setting, not the shop's). */
  sending: boolean
  /** Whether e-mail goes through Resend here: only then can a domain be verified. */
  available: boolean
  /** What the e-mail leaves by: `smtp` is the shop's own mail server. */
  transport?: "resend" | "mailpit" | "smtp" | null
  /** With the shop's own mail server: whether its domain publishes SPF, DKIM, DMARC. */
  dns?: SenderDns | null
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

export type SmtpTestResult =
  { ok: true; to: string } | { ok: false; reason: string; reply: string | null }

/** A test e-mail through the shop's mail server to the signed-in member's own address. */
export const sendSmtpTest = () =>
  sdk.client.fetch<SmtpTestResult>("/admin/messaging/smtp/test", { method: "POST", body: {} })

export interface MessageTemplateSummary {
  name: string
  kind: "transactional" | "commercial"
  channels: ("email" | "sms")[]
}

export interface MessagePreview {
  name: string
  kind: "transactional" | "commercial"
  email: { subject: string; html: string; text: string } | null
  sms: string | null
}

/** Every message the shop sends (F9.3), with its kind and channels. */
export const messageTemplatesQuery = () =>
  queryOptions({
    queryKey: ["messaging", "templates"],
    queryFn: () =>
      sdk.client.fetch<{ templates: MessageTemplateSummary[] }>("/admin/messaging/templates"),
    staleTime: Infinity,
  })

/** A template with made-up values in the shop's brand; nothing is sent. */
export const messagePreviewQuery = (name: string) =>
  queryOptions({
    queryKey: ["messaging", "templates", name, "preview"],
    queryFn: () =>
      sdk.client.fetch<MessagePreview>(
        `/admin/messaging/templates/${encodeURIComponent(name)}/preview`
      ),
    enabled: name !== "",
  })
