import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { checkAccount } from "../../../lib/integrations/account-check"
import type { AccountCheck } from "../../../lib/integrations/account-check"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import type { default as IntegrationCredentialsModuleService } from "../../../modules/integration-credentials/service"

/**
 * "Test the connection": the stored account against the provider, the
 * result kept on the account. `not_configured` when nothing usable is stored.
 */
export const checkStoredAccountStep = createStep(
  "integration-credentials-check-stored",
  async (provider: CredentialProviderName, { container }) => {
    const service = container.resolve<IntegrationCredentialsModuleService>(
      INTEGRATION_CREDENTIALS_MODULE
    )
    const account = await service.read(provider)
    if (!account) {
      return new StepResponse<AccountCheck | "not_configured">("not_configured")
    }
    const check = await checkAccount(provider, account)
    await service.recordCheck(provider, check === "valid" ? "verified" : "unverified")
    return new StepResponse<AccountCheck | "not_configured">(check)
  }
)
