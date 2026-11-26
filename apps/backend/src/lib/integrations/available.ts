import { ValidationError } from "../errors"
import { dhlEcomAvailable } from "../shipping/dhlecommerce/credentials"
import { CREDENTIAL_PROVIDERS } from "../../modules/integration-credentials/providers"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import type { CredentialStatus } from "../../modules/integration-credentials/types"

/**
 * Providers a shop on this server cannot connect with the platform's own
 * app: it is not set (adr/0027 Ek 2026-11-26, DHL eCommerce's app keys).
 * The panel says so on the provider's page and asks for the shop's own
 * app keys instead (the owner, 2026-11-26).
 */
export function unavailableProviders(): CredentialProviderName[] {
  return dhlEcomAvailable() ? [] : ["dhlecommerce"]
}

/**
 * The secrets naming the shop's own app, by provider: written (or kept)
 * together, they connect it without the platform's app.
 */
export const OWN_APP_SECRETS: Readonly<Partial<Record<CredentialProviderName, readonly string[]>>> =
  { dhlecommerce: ["client_id", "client_secret"] }

/**
 * Refuses an account for a provider this server cannot connect: no
 * platform app, and the shop neither gives an app of its own in `input`
 * (a save) nor keeps one stored for the same account (a save that leaves
 * them blank, or a check of what is stored).
 */
export function assertProviderAvailable(
  provider: CredentialProviderName,
  current: Pick<CredentialStatus, "settings" | "secrets">,
  input?: { settings: Record<string, unknown>; secrets?: Record<string, string | null> | undefined }
): void {
  if (!unavailableProviders().includes(provider)) {
    return
  }
  // Another account (a changed identity) keeps none of the stored secrets (`planSave`)
  const sameAccount =
    !input ||
    CREDENTIAL_PROVIDERS[provider].identity.every(
      (name) => current.settings?.[name] === input.settings[name]
    )
  const has = (name: string) => {
    const given = input?.secrets?.[name]
    return (
      (typeof given === "string" && given.trim() !== "") ||
      (sameAccount && current.secrets[name] === true)
    )
  }
  const names = OWN_APP_SECRETS[provider] ?? []
  if (names.length === 0 || !names.every(has)) {
    throw new ValidationError(`${provider}.unavailable`)
  }
}
