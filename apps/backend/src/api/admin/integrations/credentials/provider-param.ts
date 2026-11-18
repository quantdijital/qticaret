import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isCredentialProvider } from "../../../../modules/integration-credentials/providers"
import type { CredentialProviderName } from "../../../../modules/integration-credentials/providers"

/**
 * Accounts connected through their own consent screen only (OAuth): typed
 * in here they would skip its checks, and removing one here would leave
 * the access granted at Google (security review 2026-10-29). BirFatura's
 * token is the server's to make, never typed in (adr/0072 §3):
 * `/admin/einvoice/birfatura/token`.
 */
const CONSENT_ONLY: readonly string[] = ["google", "birfatura"]

/** The provider in the path; one the shop cannot connect here is 404. */
export function providerParam(req: MedusaRequest): CredentialProviderName {
  const provider = req.params["provider"] ?? ""
  if (!isCredentialProvider(provider) || CONSENT_ONLY.includes(provider)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "integration_credentials.unknown_provider")
  }
  return provider
}
