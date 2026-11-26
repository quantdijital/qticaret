import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isSuspended } from "../../../../lib/integrations/suspended"
import { isCredentialProvider } from "../../../../modules/integration-credentials/providers"
import type { CredentialProviderName } from "../../../../modules/integration-credentials/providers"

/**
 * Accounts connected through their own consent screen only (OAuth): typed
 * in here they would skip its checks, and removing one here would leave
 * the access granted at Google (security review 2026-10-29).
 */
const CONSENT_ONLY: readonly string[] = ["google"]

/**
 * Accounts the server makes and keeps under their own page, never here:
 * BirFatura's connection token (adr/0072 §3, `/admin/einvoice/birfatura`).
 * Neither listed nor written through the accounts routes.
 */
const KEPT_ELSEWHERE: readonly string[] = ["birfatura"]

/**
 * Whether the accounts page lists the provider: not one kept elsewhere,
 * nor a carrier suspended on this server (`lib/integrations/suspended.ts`).
 */
export const listedHere = (provider: string): boolean =>
  !KEPT_ELSEWHERE.includes(provider) && !isSuspended(provider)

/** The provider in the path; one the shop cannot connect here (or a suspended one) is 404. */
export function providerParam(req: MedusaRequest): CredentialProviderName {
  const provider = req.params["provider"] ?? ""
  if (!isCredentialProvider(provider) || CONSENT_ONLY.includes(provider) || !listedHere(provider)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "integration_credentials.unknown_provider")
  }
  return provider
}
