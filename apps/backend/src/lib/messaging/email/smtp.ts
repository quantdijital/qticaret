import { createHash, randomUUID } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import { createTransport } from "nodemailer"
import { backoffDelay, resolveRetryPolicy } from "../../clients/retry"
import type { RetryPolicy } from "../../clients/retry"
import { ProviderError, isProviderError } from "../../errors"
import { isLoopbackHost } from "./smtp-account"
import type { SmtpAccount } from "./smtp-account"
import { smtpError } from "./smtp-errors"
import { headerText } from "./transports"
import type { EmailTransport, OutgoingEmail } from "./transports"

/**
 * E-mail through the shop's own mail server (adr/0036 Ek 2026-11-10), with
 * nodemailer. One connection per message, no pool: a campaign's turn and an
 * order's confirmation never wait on each other. TLS is required (implicit
 * on 465, STARTTLS otherwise) except to a server on this machine; the
 * certificate is checked. Nothing is logged here: nodemailer's own logger
 * stays off, and an error keeps the reply's numbers only (`smtp-errors.ts`).
 */

export interface SmtpTransport extends EmailTransport {
  /** Connects and signs in, sending nothing: "test the connection". */
  verify: (signal?: AbortSignal) => Promise<void>
}

export interface SmtpTransportOptions {
  /** The instance's tag (`tenantTag`): Message-IDs of two shops never meet. */
  tenant: string
  retry?: Partial<RetryPolicy>
  /** Waits in milliseconds, for tests. */
  timeouts?: Partial<Record<"connection" | "greeting" | "socket" | "dns", number>>
}

const TIMEOUTS = { connection: 10_000, greeting: 10_000, socket: 30_000, dns: 5_000 }

/** What nodemailer is given: the server, its TLS rule, short waits, no file or URL reads. */
export function smtpOptions(account: SmtpAccount, timeouts: Partial<typeof TIMEOUTS> = {}) {
  const local = isLoopbackHost(account.host)
  if (account.security === "none" && !local) {
    // smtpAccountOf refuses it already; a second line, in case a caller builds its own
    throw new ProviderError({ provider: "smtp", providerCode: "tls_failed", retryable: false })
  }
  const wait = { ...TIMEOUTS, ...timeouts }
  return {
    host: account.host,
    port: account.port,
    secure: account.security === "tls",
    requireTLS: account.security === "starttls",
    // A local relay without TLS: no STARTTLS against a certificate made for another name
    ignoreTLS: account.security === "none",
    ...(account.username && account.password
      ? { auth: { user: account.username, pass: account.password } }
      : {}),
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    connectionTimeout: wait.connection,
    greetingTimeout: wait.greeting,
    socketTimeout: wait.socket,
    dnsTimeout: wait.dns,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

const domainOf = (address: string): string => {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(domain) ? domain : "localhost"
}

/**
 * The same send has the same Message-ID (RFC 5322 §3.6.4): a message tried
 * again after a lost answer reads as the one already delivered. The key is
 * hashed with the instance's tag; nothing of it can be read back.
 */
export function messageIdOf(tenant: string, key: string, from: string): string {
  const seed = key === "" ? randomUUID() : `${tenant}:${key}`
  const id = createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 40)
  return `<${id}@${domainOf(from)}>`
}

// An address alone: no display name, no line break, nothing nodemailer would read as a list
const ADDRESS = /^[^\s@<>,;:"()[\]\\]{1,64}@[^\s@<>,;:"()[\]\\]{1,253}$/

const addressOf = (value: string | null): string | null => {
  const address = value === null ? "" : headerText(value, 320)
  return ADDRESS.test(address) ? address : null
}

/** The message as nodemailer takes it; every header value on one line (`headerText`). */
export function smtpMessage(email: OutgoingEmail, tenant: string) {
  const to = addressOf(email.to)
  const from = addressOf(email.from.email)
  if (!to || !from) {
    throw new ProviderError({ provider: "smtp", providerCode: "invalid_address", retryable: false })
  }
  const replyTo = addressOf(email.replyTo)
  const headers = Object.fromEntries(
    Object.entries(email.headers ?? {}).map(([name, value]) => [name, headerText(value, 998)])
  )
  return {
    from: { name: headerText(email.from.name, 100), address: from },
    to: { name: "", address: to },
    ...(replyTo ? { replyTo } : {}),
    subject: headerText(email.subject, 998),
    text: email.text,
    html: email.html,
    messageId: messageIdOf(tenant, email.idempotencyKey, from),
    headers,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

function aborted(signal: AbortSignal | undefined): Promise<never> | null {
  if (!signal) {
    return null
  }
  return new Promise((_resolve, reject) => {
    const stop = () => {
      reject(new ProviderError({ provider: "smtp", providerCode: "aborted", retryable: false }))
    }
    if (signal.aborted) {
      stop()
    } else {
      signal.addEventListener("abort", stop, { once: true })
    }
  })
}

/** nodemailer's call, its error turned into ours; given up on once the signal aborts. */
async function call<T>(run: () => Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  const work = run().catch((error: unknown) => {
    if (error instanceof ProviderError) {
      throw error
    }
    throw smtpError(error)
  })
  const stop = aborted(signal)
  return stop ? Promise.race([work, stop]) : work
}

export function createSmtpTransport(
  account: SmtpAccount,
  { tenant, retry, timeouts }: SmtpTransportOptions
): SmtpTransport {
  const policy = resolveRetryPolicy(retry)
  const transporter = createTransport(smtpOptions(account, timeouts))
  return {
    name: "smtp",
    send: async (email, signal) => {
      const message = smtpMessage(email, tenant)
      // A "try later" or an unreached server is tried again, as the HTTP client does
      for (let attempt = 0; ; attempt += 1) {
        try {
          await call(() => transporter.sendMail(message), signal)
          // Our Message-ID is the send's id: the one the recipient's server knows it by
          return { id: message.messageId.slice(1, -1) }
        } catch (error) {
          const last = attempt + 1 >= policy.attempts
          if (last || !isProviderError(error) || !error.retryable || signal?.aborted) {
            throw error
          }
          await sleep(backoffDelay(attempt, policy))
        }
      }
    },
    verify: async (signal) => {
      await call(() => transporter.verify(), signal)
    },
  }
}
