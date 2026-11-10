import { ValidationError, isProviderError } from "../../errors"
import { tenantTag } from "./index"
import { createSmtpTransport } from "./smtp"
import { smtpAccountOf } from "./smtp-account"

type Verdict = "valid" | "merchant_invalid" | "secret_invalid"

/**
 * "Test the connection" for the shop's mail server (adr/0027 §4): it
 * connects, agrees on TLS and signs in; nothing is sent. A refused login is
 * the password's, a TLS failure the security setting's. A server not
 * reached throws, as every provider's check does (`unreachable`).
 */
export async function checkSmtp(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> },
  signal: AbortSignal
): Promise<Verdict> {
  const smtp = smtpAccountOf(account)
  if (!smtp) {
    return "secret_invalid"
  }
  try {
    await createSmtpTransport(smtp, { tenant: tenantTag(), retry: { attempts: 1 } }).verify(signal)
    return "valid"
  } catch (error) {
    if (isProviderError(error) && error.providerCode === "auth_failed") {
      return "secret_invalid"
    }
    if (isProviderError(error) && error.providerCode === "tls_failed") {
      return "merchant_invalid"
    }
    // The SSRF policy (smtp-target.ts): the name leads inside, or the port is not a mail port
    if (isProviderError(error) && error.providerCode === "target_refused") {
      throw new ValidationError("smtp.host_refused", { field: "settings.host" })
    }
    if (isProviderError(error) && error.providerCode === "port_refused") {
      throw new ValidationError("smtp.port_invalid", { field: "settings.port" })
    }
    throw error
  }
}
