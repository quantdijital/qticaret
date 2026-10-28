import { parseEnv } from "../../env"
import type { Env } from "../../env"
import { createMailpitTransport, createResendTransport } from "./transports"
import type { EmailTransport } from "./transports"

export { RESEND_URL, createMailpitTransport, createResendTransport, mailbox } from "./transports"
export type { EmailTransport, OutgoingEmail } from "./transports"

function build(env: Env): EmailTransport | null {
  if (env.EMAIL_TRANSPORT === "resend" && env.RESEND_API_KEY) {
    return createResendTransport(
      env.RESEND_API_KEY,
      env.RESEND_BASE_URL ? { baseUrl: env.RESEND_BASE_URL } : {}
    )
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
  const key = [env.EMAIL_TRANSPORT, env.MAILPIT_URL, env.RESEND_BASE_URL].join("|")
  if (shared?.key !== key) {
    shared = { key, transport: build(env) }
  }
  return shared.transport
}

/** The platform's sender address, until the shop's own domain is verified (N6). */
export const platformSender = (): string | null => parseEnv().EMAIL_FROM ?? null
