import { isIP } from "node:net"

/**
 * The shop's own mail server (adr/0036 Ek 2026-11-10), as the panel stores
 * it (`integration-credentials` `smtp`): the server, how it is secured, the
 * login, the address mail goes from, and how many campaign e-mails a minute
 * it is given.
 */

export type SmtpSecurity = "tls" | "starttls" | "none"

export interface SmtpAccount {
  host: string
  port: number
  /** `tls`: implicit TLS (465); `starttls`: required STARTTLS (587); `none`: loopback only. */
  security: SmtpSecurity
  /** No login: a local relay that takes mail from this machine. */
  username: string | null
  password: string | null
  fromEmail: string
  /** The name on the From line; null keeps the shop's name. */
  fromName: string | null
  /** Campaign e-mails a minute at most (adr/0050 §6); transactional mail is not held back. */
  ratePerMinute: number
}

/** The ports a mail server listens on for submission and relay (RFC 6409, 8314). */
export const SMTP_PORTS: readonly number[] = [25, 465, 587, 2525]

export const DEFAULT_SMTP_RATE = 30
export const MAX_SMTP_RATE = 300

/** A host name (lowercase, IDNA as typed by the shop) or an IP address. */
const HOST_NAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/

export const isSmtpHost = (host: string): boolean => HOST_NAME.test(host) || isIP(host) !== 0

/**
 * This machine itself: `localhost`, 127.0.0.0/8 or ::1. Only there may mail
 * go without TLS (a local Postfix); a Docker container's host is not
 * loopback from inside it (docs/08).
 */
export function isLoopbackHost(host: string): boolean {
  const name = host.toLowerCase()
  if (name === "localhost" || name === "::1" || name === "0:0:0:0:0:0:0:1") {
    return true
  }
  return isIP(name) === 4 && name.startsWith("127.")
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null

const SECURITIES: readonly string[] = ["tls", "starttls", "none"]

/** The stored account, or null when it is not one we can send with. */
export function smtpAccountOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): SmtpAccount | null {
  if (!account) {
    return null
  }
  const { settings, secrets } = account
  const host = text(settings["host"])?.toLowerCase() ?? null
  const port = settings["port"]
  const security = settings["security"]
  const fromEmail = text(settings["from_email"])
  if (
    !host ||
    !isSmtpHost(host) ||
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    typeof security !== "string" ||
    !SECURITIES.includes(security) ||
    !fromEmail ||
    // Plain text leaves this machine never, whatever the row says
    (security === "none" && !isLoopbackHost(host))
  ) {
    return null
  }
  const username = text(settings["username"])
  const password = secrets["password"] ?? null
  if (username && !password) {
    return null
  }
  const rate = settings["rate_per_minute"]
  return {
    host,
    port,
    security: security as SmtpSecurity,
    username,
    password: username ? password : null,
    fromEmail,
    fromName: text(settings["from_name"]),
    ratePerMinute:
      typeof rate === "number" && Number.isInteger(rate) && rate >= 1 && rate <= MAX_SMTP_RATE
        ? rate
        : DEFAULT_SMTP_RATE,
  }
}

/** A campaign turn's pace on this account: as many as a minute allows, evenly apart. */
export const smtpPace = (account: SmtpAccount): { batch: number; spacingMs: number } => ({
  batch: account.ratePerMinute,
  spacingMs: Math.ceil(60_000 / account.ratePerMinute),
})
