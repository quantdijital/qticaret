import { parseEnv } from "../../env"
import type { Env } from "../../env"
import { createMailpitTransport, createResendTransport } from "./transports"
import type { EmailTransport } from "./transports"

export {
  RESEND_URL,
  createMailpitTransport,
  createResendTransport,
  headerText,
  mailbox,
} from "./transports"
export type { EmailTransport, OutgoingEmail } from "./transports"

/**
 * The instance's name on what it sends (its backend's host): Resend reports
 * every send of an account to each of its webhooks, and keeps idempotency
 * keys per account, so a send carries it and a report without it is not ours.
 */
export function tenantTag(env: Env = parseEnv()): string {
  const host = env.BACKEND_URL ? new URL(env.BACKEND_URL).host : "local"
  return host.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200)
}

function build(env: Env): EmailTransport | null {
  if (env.EMAIL_TRANSPORT === "resend" && env.RESEND_API_KEY) {
    return createResendTransport(env.RESEND_API_KEY, {
      tenant: tenantTag(env),
      ...(env.RESEND_BASE_URL ? { baseUrl: env.RESEND_BASE_URL } : {}),
    })
  }
  if (env.EMAIL_TRANSPORT === "mailpit" && env.MAILPIT_URL) {
    return createMailpitTransport(env.MAILPIT_URL)
  }
  return null
}

let shared: { key: string; transport: EmailTransport | null } | undefined

/**
 * The instance's e-mail transport (adr/0036), built once per setting; null
 * when e-mail is off (`EMAIL_TRANSPORT` unset), and nothing is sent.
 */
export function emailTransport(): EmailTransport | null {
  const env = parseEnv()
  const key = [env.EMAIL_TRANSPORT, env.MAILPIT_URL, env.RESEND_BASE_URL, env.BACKEND_URL].join("|")
  if (shared?.key !== key) {
    shared = { key, transport: build(env) }
  }
  return shared.transport
}

/** The platform's sender address, until the shop's own domain is verified (N6). */
export const platformSender = (): string | null => parseEnv().EMAIL_FROM ?? null
