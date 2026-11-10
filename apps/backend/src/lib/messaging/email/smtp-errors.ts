import { ProviderError } from "../../errors"

/**
 * What an SMTP server's refusal means for us (adr/0036 Ek 2026-11-10),
 * from nodemailer's error fields (`code`, `command`, `responseCode`,
 * `response`, `originalCode`). Only the reply's numbers leave this file
 * (`550 5.1.1`): its words may quote the recipient's address, and nothing
 * of the original error is kept as a cause.
 *
 * - `recipient_rejected`: the mailbox does not exist or is disabled, said
 *   for good at RCPT TO or after DATA (5xx with 5.1.x or 5.2.1, or a bare
 *   550/551/553 at RCPT). The address goes on the suppression list.
 * - `rejected`: any other 5xx (the sender refused, a policy, the content):
 *   ours to fix, not the recipient's; never suppresses an address.
 * - `deferred`: a 4xx, the server's "try later"; tried again.
 * - `auth_failed`, `tls_failed`: the account's details; not tried again.
 * - `connection_refused`, `dns_failed`, `timeout`, `network_error`: the
 *   server was not reached; tried again.
 * - `outcome_unknown`: the connection broke after the message was handed
 *   over, so it may have gone; not tried again (the next send uses the
 *   same Message-ID, which mail clients take as the same message).
 */

export type SmtpFailure =
  | "recipient_rejected"
  | "rejected"
  | "deferred"
  | "auth_failed"
  | "tls_failed"
  | "connection_refused"
  | "dns_failed"
  | "timeout"
  | "network_error"
  | "outcome_unknown"
  | "failed"

const RETRYABLE: ReadonlySet<SmtpFailure> = new Set([
  "deferred",
  "connection_refused",
  "dns_failed",
  "timeout",
  "network_error",
])

/** The fields nodemailer puts on its errors (nodemailer.com/errors). */
interface NodemailerFields {
  code?: unknown
  command?: unknown
  responseCode?: unknown
  response?: unknown
  originalCode?: unknown
  timeoutType?: unknown
  rejectedErrors?: unknown
}

const text = (value: unknown): string => (typeof value === "string" ? value : "")

// The reply's three digits and its enhanced status code (RFC 3463), nothing else
const ENHANCED = /\b([245])\.(\d{1,3})\.(\d{1,3})\b/

export interface SmtpReply {
  code: number | null
  enhanced: string | null
}

export function replyOf(fields: NodemailerFields): SmtpReply {
  const response = text(fields.response)
  const code =
    typeof fields.responseCode === "number" && Number.isInteger(fields.responseCode)
      ? fields.responseCode
      : /^([2-5]\d\d)\b/.test(response)
        ? Number(response.slice(0, 3))
        : null
  const enhanced = ENHANCED.exec(response)?.[0] ?? null
  return { code, enhanced }
}

/** `550 5.1.1`, `421`, or nothing when the server said nothing. */
export const replyText = (reply: SmtpReply): string | undefined =>
  reply.code === null ? undefined : [reply.code, reply.enhanced].filter(Boolean).join(" ")

/** All recipients refused: nodemailer's EENVELOPE carries each refusal in `rejectedErrors`. */
function fieldsOf(error: unknown): NodemailerFields {
  const fields = (typeof error === "object" && error !== null ? error : {}) as NodemailerFields
  const first: unknown = Array.isArray(fields.rejectedErrors)
    ? (fields.rejectedErrors as unknown[])[0]
    : undefined
  if (text(fields.code) === "EENVELOPE" && typeof first === "object" && first !== null) {
    return { ...(first as NodemailerFields), code: "EENVELOPE", command: "RCPT TO" }
  }
  return fields
}

const TLS_CODE = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)|HOSTNAME|ALTNAME/i

/** Whether a 5xx is about the mailbox itself (RFC 3463 X.1.x address, X.2.1 disabled). */
function mailboxGone(command: string, reply: SmtpReply): boolean {
  if (command !== "RCPT TO" && command !== "DATA") {
    return false
  }
  if (reply.enhanced) {
    return /^5\.1\.\d+$/.test(reply.enhanced) || reply.enhanced === "5.2.1"
  }
  // No enhanced code: only RCPT's own "no such user" replies (RFC 5321 §4.2.2)
  return command === "RCPT TO" && [550, 551, 553].includes(reply.code ?? 0)
}

export function smtpFailureOf(error: unknown): SmtpFailure {
  const fields = fieldsOf(error)
  const code = text(fields.code)
  const command = text(fields.command).toUpperCase()
  const original = text(fields.originalCode)
  const reply = replyOf(fields)
  if (code === "EAUTH" || code === "ENOAUTH" || reply.code === 535) {
    return "auth_failed"
  }
  if (code === "ETLS" || code === "EREQUIRETLS" || TLS_CODE.test(original)) {
    return "tls_failed"
  }
  if (reply.code !== null && reply.code >= 400 && reply.code < 500) {
    return "deferred"
  }
  if (reply.code !== null && reply.code >= 500) {
    return mailboxGone(command, reply) ? "recipient_rejected" : "rejected"
  }
  if (code === "EDNS" || original === "ENOTFOUND" || original === "EAI_AGAIN") {
    return "dns_failed"
  }
  if (original === "ECONNREFUSED" || original === "EHOSTUNREACH" || original === "ENETUNREACH") {
    return "connection_refused"
  }
  if (code === "ETIMEDOUT") {
    // A wait that ran out while the message was being handed over may have delivered it
    return text(fields.timeoutType) === "SOCKET_TIMEOUT" && command === "DATA"
      ? "outcome_unknown"
      : "timeout"
  }
  if (code === "ECONNECTION" || code === "ESOCKET") {
    return command === "DATA" ? "outcome_unknown" : "network_error"
  }
  return "failed"
}

/** The error a send or a check throws: the failure, whether to try again, the reply's numbers. */
export function smtpError(error: unknown): ProviderError {
  const failure = smtpFailureOf(error)
  const said = replyText(replyOf(fieldsOf(error)))
  return new ProviderError({
    provider: "smtp",
    providerCode: failure,
    retryable: RETRYABLE.has(failure),
    ...(said ? { providerMessage: said } : {}),
  })
}
