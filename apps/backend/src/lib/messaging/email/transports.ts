import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"

/**
 * Where an e-mail leaves us (adr/0036): Resend once deployed, Mailpit on a
 * developer's machine. Both take JSON over our HTTP client, so no SMTP
 * library is needed; neither request is ever logged with its body.
 */

/** An e-mail as our templates make it. */
export interface OutgoingEmail {
  from: { email: string; name: string }
  to: string
  replyTo: string | null
  subject: string
  html: string
  text: string
  /** Our template's name, for the provider's own reports. */
  template: string
  /** The same key sends once: Resend keeps it for 24 hours. */
  idempotencyKey: string
}

export interface EmailTransport {
  readonly name: "resend" | "mailpit"
  send: (email: OutgoingEmail, signal?: AbortSignal) => Promise<{ id: string }>
}

export const RESEND_URL = "https://api.resend.com"

type TransportOptions = Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & {
  baseUrl?: string
}

/** A display name as one header word: no line break, quotes and backslashes escaped. */
export function mailbox(address: { email: string; name: string }): string {
  const name = address.name
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 100)
  return name === ""
    ? address.email
    : `"${name.replace(/[\\"]/g, (char) => `\\${char}`)}" <${address.email}>`
}

/** A tag value as both providers take it: ASCII letters, digits, dashes and underscores. */
const tagOf = (template: string): string => template.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)

// Resend names its errors (`validation_error`, `rate_limit_exceeded`); only such a name is kept
const resendErrorCode = (body: unknown): string | undefined => {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === "string" && /^[a-z_]{1,40}$/.test(name) ? name : undefined
}

export function createResendTransport(
  apiKey: string,
  options: TransportOptions = {}
): EmailTransport {
  const client = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? RESEND_URL,
    provider: "resend",
    defaultHeaders: { authorization: `Bearer ${apiKey}` },
    errorCode: resendErrorCode,
  })
  return {
    name: "resend",
    send: async (email, signal) => {
      const answer = await client.request({
        method: "POST",
        path: "/emails",
        headers: { "idempotency-key": email.idempotencyKey },
        json: {
          from: mailbox(email.from),
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          tags: [{ name: "template", value: tagOf(email.template) }],
        },
        // Resend sends a key once: a repeat after a lost answer is safe
        idempotent: true,
        ...(signal ? { signal } : {}),
        schema: z.object({ id: z.string().min(1).max(200) }),
      })
      return { id: answer.id }
    },
  }
}

/** Mailpit's HTTP send endpoint (`POST /api/v1/send`), checked against v1.31.4's source. */
export function createMailpitTransport(
  baseUrl: string,
  options: TransportOptions = {}
): EmailTransport {
  const client = createHttpClient({ ...options, baseUrl, provider: "mailpit" })
  return {
    name: "mailpit",
    send: async (email, signal) => {
      const answer = await client.request({
        method: "POST",
        path: "/api/v1/send",
        json: {
          From: { Email: email.from.email, Name: email.from.name },
          To: [{ Email: email.to }],
          ReplyTo: email.replyTo ? [{ Email: email.replyTo }] : [],
          Subject: email.subject,
          Text: email.text,
          HTML: email.html,
          Headers: { "X-Qt-Template": email.template, "X-Qt-Key": email.idempotencyKey },
          Tags: [tagOf(email.template)],
        },
        idempotent: true,
        ...(signal ? { signal } : {}),
        schema: z.object({ ID: z.string().min(1).max(200) }),
      })
      return { id: answer.ID }
    },
  }
}
