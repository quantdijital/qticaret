import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { emailTransport, tenantTag } from "./index"
import { createSmtpTransport } from "./smtp"
import type { SmtpTransport } from "./smtp"
import { smtpAccountOf } from "./smtp-account"
import type { SmtpAccount } from "./smtp-account"
import type { EmailTransport } from "./transports"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Which transport the shop's e-mail leaves by (adr/0036 Ek 2026-11-10):
 * the shop's own mail server when it saved one in the panel, else the
 * instance's (`EMAIL_TRANSPORT`: Resend, Mailpit on a developer's machine),
 * else none. Read at the time of each send, from the credentials' cache.
 */

/** The shop's saved mail server, or null (none saved, or not one we can send with). */
export async function shopSmtpAccount(container: Container): Promise<SmtpAccount | null> {
  const stored = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("smtp")
  return smtpAccountOf(stored)
}

let built: { key: string; transport: SmtpTransport } | undefined

/** One transport per account as saved: a changed account (or password) builds a new one. */
export function smtpTransportFor(account: SmtpAccount): SmtpTransport {
  const tenant = tenantTag()
  // A digest, so the password is not kept in a second place in the clear
  const key = createHash("sha256")
    .update(JSON.stringify({ ...account, tenant }))
    .digest("hex")
  if (built?.key !== key) {
    built = { key, transport: createSmtpTransport(account, { tenant }) }
  }
  return built.transport
}

export async function shopEmailTransport(container: Container): Promise<EmailTransport | null> {
  const smtp = await shopSmtpAccount(container)
  return smtp ? smtpTransportFor(smtp) : emailTransport()
}
