import { ValidationError } from "../errors"
import { dhlEcomAvailable } from "../shipping/dhlecommerce/credentials"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"

/**
 * Providers a shop on this server cannot connect yet: the platform's own
 * app with them is not set (adr/0027 Ek 2026-11-26, DHL eCommerce's app
 * keys). The panel says so on the provider's page; a save is refused.
 */
export function unavailableProviders(): CredentialProviderName[] {
  return dhlEcomAvailable() ? [] : ["dhlecommerce"]
}

/** Refuses an account for a provider this server cannot connect. */
export function assertProviderAvailable(provider: CredentialProviderName): void {
  if (unavailableProviders().includes(provider)) {
    throw new ValidationError(`${provider}.unavailable`)
  }
}
