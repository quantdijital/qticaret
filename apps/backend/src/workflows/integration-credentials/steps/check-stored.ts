import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { checkAccount } from "../../../lib/integrations/account-check"
import type { AccountCheck } from "../../../lib/integrations/account-check"
import type { Verification } from "../../../modules/integration-credentials/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import type { default as IntegrationCredentialsModuleService } from "../../../modules/integration-credentials/service"

const VERDICTS: Readonly<Record<AccountCheck, Verification | null>> = {
  valid: "verified",
  merchant_invalid: "rejected",
  secret_invalid: "rejected",
  unreachable: null,
  failed: null,
  // The provider answered without proving the details: a "verified" kept before must not stand
  unconfirmed: "unverified",
}

/**
 * "Test the connection": the stored account against the provider, the
 * result kept on the account. `not_configured` when nothing usable is stored.
 * No compensation: the check changes nothing at the provider, and the
 * result it records is true of the row it checked.
 */
export const checkStoredAccountStep = createStep(
  "integration-credentials-check-stored",
  async (provider: CredentialProviderName, { container }) => {
    const service = container.resolve<IntegrationCredentialsModuleService>(
      INTEGRATION_CREDENTIALS_MODULE
    )
    // The row as it is now, not the cache: a save just before is what gets checked
    const stored = await service.readForCheck(provider)
    if (!stored) {
      return new StepResponse<AccountCheck | "not_configured">("not_configured")
    }
    const check = await checkAccount(provider, stored.account)
    // An unreachable provider or an answer out of its documentation says
    // nothing about the details: a working account stays as it is
    const verification = VERDICTS[check]
    if (verification) {
      // Kept only if the account did not change meanwhile; a newer save keeps its own state
      await service.recordCheck(provider, verification, stored.stamp)
    }
    return new StepResponse<AccountCheck | "not_configured">(check)
  }
)
