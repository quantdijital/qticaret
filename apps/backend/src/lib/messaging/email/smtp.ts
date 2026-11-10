import { createHash, randomUUID } from "node:crypto"
import { isIP } from "node:net"
import { setTimeout as sleep } from "node:timers/promises"
import { createTransport } from "nodemailer"
import { backoffDelay, resolveRetryPolicy } from "../../clients/retry"
import type { RetryPolicy } from "../../clients/retry"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import type { SmtpAccount } from "./smtp-account"
import { smtpError } from "./smtp-errors"
import { pinnedConnection } from "./smtp-socket"
import type { PinnedConnection } from "./smtp-socket"
import { resolveSmtpTarget } from "./smtp-target"
import type { SmtpTarget, TargetOptions } from "./smtp-target"
import { headerText } from "./transports"
import type { EmailTransport, OutgoingEmail } from "./transports"

/**
 * E-mail through the shop's own mail server (adr/0036 Ek 2026-11-10), with
 * nodemailer. One connection per message, no pool: a campaign's turn and an
 * order's confirmation never wait on each other. Each attempt resolves the
 * host again and connects to the address the SSRF policy allowed
 * (`smtp-target.ts`, `smtp-socket.ts`). TLS is required (implicit on 465,
 * STARTTLS otherwise) except to a server on this machine; the certificate is
 * checked against the typed name. Nothing is logged here: nodemailer's own
 * logger stays off, and an error keeps the reply's numbers only
 * (`smtp-errors.ts`).
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
  /** The resolver and the environment, for tests. */
  target?: TargetOptions
}

const TIMEOUTS = { connection: 10_000, greeting: 10_000, socket: 30_000, dns: 5_000 }

const FQDN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/

/**
 * The name we greet the server with (EHLO): the instance's public host, else
 * the sender's domain; never this machine's own name or `[127.0.0.1]`,
 * which mail servers read as a spammer's.
 */
export function ehloNameOf(from: string): string {
  let host: string
  try {
    const url = parseEnv().BACKEND_URL
    host = url ? new URL(url).hostname.toLowerCase() : ""
  } catch {
    host = ""
  }
  return FQDN.test(host) && isIP(host) === 0 ? host : domainOf(from)
}

/** What nodemailer is given: the allowed address, its TLS rule, short waits, no file or URL reads. */
export function smtpOptions(
  account: SmtpAccount,
  target: SmtpTarget,
  timeouts: Partial<typeof TIMEOUTS> = {}
) {
  if (account.security === "none" && !target.loopback) {
    // smtpAccountOf and the target refuse it already; a last line, in case a caller builds its own
    throw new ProviderError({ provider: "smtp", providerCode: "tls_failed", retryable: false })
  }
  const wait = { ...TIMEOUTS, ...timeouts }
  return {
    host: target.address,
    port: account.port,
    name: ehloNameOf(account.fromEmail),
    secure: account.security === "tls",
    requireTLS: account.security === "starttls",
    // A local relay without TLS: no STARTTLS against a certificate made for another name
    ignoreTLS: account.security === "none",
    ...(account.username && account.password
      ? { auth: { user: account.username, pass: account.password } }
      : {}),
    // The certificate is checked against the name the shop typed, not the address
    ...(target.servername ? { servername: target.servername } : {}),
    tls: {
      minVersion: "TLSv1.2" as const,
      rejectUnauthorized: true,
      ...(target.servername ? { servername: target.servername } : {}),
    },
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

const abortError = () =>
  new ProviderError({ provider: "smtp", providerCode: "aborted", retryable: false })

type Transporter = ReturnType<typeof createTransport>

/**
 * One attempt: the host resolved and checked again, nodemailer handed a
 * socket to that address, its error turned into ours. Once the signal
 * aborts, the attempt's sockets are destroyed, so nothing goes after the
 * caller gave up, and the transporter is closed.
 */
async function attempt<T>(
  account: SmtpAccount,
  options: SmtpTransportOptions,
  signal: AbortSignal | undefined,
  run: (transporter: Transporter) => Promise<T>
): Promise<T> {
  if (signal?.aborted) {
    throw abortError()
  }
  const target = await resolveSmtpTarget(account, options.target)
  const settings = smtpOptions(account, target, options.timeouts)
  const pinned: PinnedConnection = pinnedConnection(target, account.port, {
    timeoutMs: settings.connectionTimeout,
    // Only a conversation still in plain text shows the EHLO reply
    plain: account.security !== "tls",
  })
  const transporter = createTransport({ ...settings, getSocket: pinned.getSocket } as Parameters<
    typeof createTransport
  >[0])
  let stop: (() => void) | undefined
  const stopped = new Promise<never>((_resolve, reject) => {
    stop = () => {
      pinned.destroy()
      transporter.close()
      reject(abortError())
    }
    signal?.addEventListener("abort", stop, { once: true })
  })
  // Unobserved when the work wins
  stopped.catch(() => undefined)
  try {
    return await Promise.race([
      run(transporter).catch((error: unknown) => {
        throw error instanceof ProviderError ? error : smtpError(error, pinned.facts)
      }),
      stopped,
    ])
  } finally {
    if (stop) {
      signal?.removeEventListener("abort", stop)
    }
    transporter.close()
  }
}

export function createSmtpTransport(
  account: SmtpAccount,
  options: SmtpTransportOptions
): SmtpTransport {
  const policy = resolveRetryPolicy(options.retry)
  return {
    name: "smtp",
    send: async (email, signal) => {
      const message = smtpMessage(email, options.tenant)
      // A "try later" or an unreached server is tried again, as the HTTP client does
      for (let tries = 0; ; tries += 1) {
        try {
          await attempt(account, options, signal, (transporter) => transporter.sendMail(message))
          // Our Message-ID is the send's id: the one the recipient's server knows it by
          return { id: message.messageId.slice(1, -1) }
        } catch (error) {
          const last = tries + 1 >= policy.attempts
          if (last || !isProviderError(error) || !error.retryable || signal?.aborted) {
            throw error
          }
          await sleep(backoffDelay(tries, policy))
        }
      }
    },
    verify: async (signal) => {
      await attempt(account, options, signal, (transporter) => transporter.verify())
    },
  }
}
