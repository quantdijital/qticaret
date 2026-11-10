import { ProviderError } from "../../errors"

/**
 * What an SMTP server's refusal means for us (adr/0036 Ek 2026-11-10),
 * from nodemailer's error fields (`code`, `command`, `responseCode`,
 * `response`, `originalCode`). Only the reply's numbers leave this file
 * (`550 5.1.1`): its words may quote the recipient's address, and nothing
 * of the original error is kept as a cause.
 *
 * - `recipient_rejected`: the recipient's mailbox does not exist or is
 *   disabled, said for good at RCPT TO, and only then (security review M2):
 *   enhanced codes 5.1.1, 5.1.2, 5.1.3, 5.1.6, 5.1.10 or 5.2.1; a bare
 *   550/551 only from a server that did not advertise ENHANCEDSTATUSCODES.
 *   The address goes on the suppression list (`smtp-bounce.ts`).
 * - `rejected`: any other 5xx (the sender refused, 5.1.0/5.1.7/5.1.8, a
 *   policy, the content, anything after DATA): ours to fix, not the
 *   recipient's; never suppresses an address.
 * - `deferred`: a 4xx, the server's "try later"; tried again.
 * - `auth_failed`, `tls_failed`: the account's details; not tried again.
 * - `connection_refused`, `dns_failed`, `timeout`, `network_error`: the
 *   server was not reached; tried again. The panel says only "unreachable"
 *   for all four, so the button cannot map a network.
 * - `outcome_unknown`: the connection broke after the message was handed
 *   over, so it may have gone; not tried again (the next send uses the
 *   same Message-ID, which mail clients take as the same message).
 * - `target_refused`, `port_refused` (`smtp-target.ts`): not connected at
 *   all, by the SSRF policy.
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

/** The server said the mailbox is not there (RFC 3463); 5.1.0/7/8 are the sender's. */
export const MAILBOX_GONE: ReadonlySet<string> = new Set([
  "5.1.1",
  "5.1.2",
  "5.1.3",
  "5.1.6",
  "5.1.10",
  "5.2.1",
])

/** What the connection learnt of the server: whether its EHLO listed ENHANCEDSTATUSCODES. */
export interface ServerFacts {
  /** null: not seen (an implicit-TLS connection hides it), which counts as listed. */
  enhancedCodes: boolean | null
}

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

// The reply's three digits, then its enhanced code (RFC 3463) at the start of the text
const REPLY = /^([2-5])(\d\d)[ -](?:([245])\.(\d{1,3})\.(\d{1,3})\b)?/

export interface SmtpReply {
  code: number | null
  /** Only when its class is the reply's own (a 550 says 5.x.x). */
  enhanced: string | null
}

export function replyOf(fields: NodemailerFields): SmtpReply {
  const response = text(fields.response)
  const match = REPLY.exec(response)
  const code =
    typeof fields.responseCode === "number" && Number.isInteger(fields.responseCode)
      ? fields.responseCode
      : match
        ? Number(`${match[1] ?? ""}${match[2] ?? ""}`)
        : null
  const enhanced =
    match?.[3] && code !== null && match[3] === String(code)[0]
      ? `${match[3]}.${match[4] ?? ""}.${match[5] ?? ""}`
      : null
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
const UNREACHED = new Set(["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ECONNRESET"])

/** Whether a 5xx at RCPT TO says the recipient's mailbox is not there. */
function mailboxGone(command: string, reply: SmtpReply, facts: ServerFacts): boolean {
  if (command !== "RCPT TO") {
    return false
  }
  if (reply.enhanced) {
    return MAILBOX_GONE.has(reply.enhanced)
  }
  // No enhanced code: only from a server known not to give them (RFC 5321 §4.2.2)
  return facts.enhancedCodes === false && [550, 551].includes(reply.code ?? 0)
}

export function smtpFailureOf(
  error: unknown,
  facts: ServerFacts = { enhancedCodes: null }
): SmtpFailure {
  const fields = fieldsOf(error)
  const code = text(fields.code)
  const command = text(fields.command).toUpperCase()
  const original = text(fields.originalCode) || code
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
    return mailboxGone(command, reply, facts) ? "recipient_rejected" : "rejected"
  }
  if (code === "EDNS" || original === "ENOTFOUND" || original === "EAI_AGAIN") {
    return "dns_failed"
  }
  if (UNREACHED.has(original) && command !== "DATA") {
    return "connection_refused"
  }
  if (code === "ETIMEDOUT") {
    // A wait that ran out while the message was being handed over may have delivered it
    return text(fields.timeoutType) === "SOCKET_TIMEOUT" && command === "DATA"
      ? "outcome_unknown"
      : "timeout"
  }
  if (code === "ECONNECTION" || code === "ESOCKET" || UNREACHED.has(original)) {
    return command === "DATA" ? "outcome_unknown" : "network_error"
  }
  return "failed"
}

/** The error a send or a check throws: the failure, whether to try again, the reply's numbers. */
export function smtpError(error: unknown, facts?: ServerFacts): ProviderError {
  const failure = smtpFailureOf(error, facts)
  const said = replyText(replyOf(fieldsOf(error)))
  return new ProviderError({
    provider: "smtp",
    providerCode: failure,
    retryable: RETRYABLE.has(failure),
    ...(said ? { providerMessage: said } : {}),
  })
}
