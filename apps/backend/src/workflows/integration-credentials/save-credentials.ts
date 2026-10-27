import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { CredentialDraft } from "../../modules/integration-credentials/service"
import { checkDraftStep } from "./steps/check-account"
import { storeCredentialsStep } from "./steps/store-credentials"

export interface SaveCredentialsInput {
  /** Sealed by the module before the workflow: no secret in the clear here (adr/0027). */
  draft: CredentialDraft
  actor_id: string | null
}

/**
 * Connects or updates a provider account from the panel (adr/0027): the
 * provider is asked first when the account or a secret changed, then the
 * sealed details are stored.
 */
export const saveIntegrationCredentialsWorkflow = createWorkflow(
  "integration-credentials-save",
  (input: SaveCredentialsInput) => {
    const checked = checkDraftStep(input.draft)
    const stored = transform({ input, checked }, ({ input, checked }) => ({
      draft: input.draft,
      verification: checked.verification,
      actor_id: input.actor_id,
    }))
    storeCredentialsStep(stored)
    return new WorkflowResponse(checked)
  }
)
