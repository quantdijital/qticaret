import { parseEnv } from "../env"

/**
 * Where the control plane's e-mail leaves (adr/0061 Ek C4): Mailpit's send
 * API on a developer's machine, nothing elsewhere yet. A minimal copy of
 * the shop's transport (apps/backend lib/messaging/email): that one rides
 * the shop's HTTP client (retries, breaker, safe fetch), which stays in the
 * shop; the deployed transport comes with F16. No body is ever logged.
 */

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
  html: string
  /** Our template's name. */
  template: string
}

export interface EmailTransport {
  readonly name: "mailpit"
  send: (email: OutgoingEmail) => Promise<void>
}

const SEND_TIMEOUT_MS = 10_000

// Invisible format characters (bidi overrides, zero-width spaces, BOM); the emoji joiner stays
const FORMAT_CHARACTERS = new RegExp("(?!\\u200d)\\p{Cf}", "gu")

/** A header's text on one line (the shop's `headerText`). */
export const headerText = (value: string, max: number): string =>
  value
    .replace(/[\p{Cc}\u2028\u2029]+/gu, " ")
    .replace(FORMAT_CHARACTERS, "")
    .trim()
    .slice(0, max)

/** Mailpit's HTTP send endpoint (`POST /api/v1/send`, v1.31.4, as the shop's). */
export function createMailpitTransport(baseUrl: string, from: string): EmailTransport {
  const url = new URL("/api/v1/send", baseUrl)
  return {
    name: "mailpit",
    send: async (email) => {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          From: { Email: from, Name: "Quant Ticaret" },
          To: [{ Email: email.to }],
          Subject: headerText(email.subject, 998),
          Text: email.text,
          HTML: email.html,
          Headers: { "X-Qt-Template": email.template },
          Tags: [email.template.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)],
        }),
        redirect: "error",
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
      if (!answer.ok) {
        throw new Error(`mailpit answered ${String(answer.status)}`)
      }
    },
  }
}

let shared: { key: string; transport: EmailTransport | null } | undefined

/** The control plane's transport; null when e-mail is off (`EMAIL_TRANSPORT` unset). */
export function emailTransport(): EmailTransport | null {
  const env = parseEnv()
  const key = [env.EMAIL_TRANSPORT, env.MAILPIT_URL, env.EMAIL_FROM].join("|")
  if (shared?.key !== key) {
    shared = {
      key,
      transport:
        env.EMAIL_TRANSPORT === "mailpit" && env.MAILPIT_URL && env.EMAIL_FROM
          ? createMailpitTransport(env.MAILPIT_URL, env.EMAIL_FROM)
          : null,
    }
  }
  return shared.transport
}
