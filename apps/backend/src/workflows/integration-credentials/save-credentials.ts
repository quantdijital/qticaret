import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { CredentialDraft } from "../../modules/integration-credentials/service"
import { checkDraftStep } from "./steps/check-draft"
import { notifyAccountChangeStep } from "./steps/notify-account-change"
import { storeCredentialsStep } from "./steps/store-credentials"

export interface SaveCredentialsInput {
  /** Sealed by the module before the workflow: no secret in the clear here (adr/0027). */
  draft: CredentialDraft
  actor_id: string | null
}

/**
 * Connects or updates a provider account from the panel (adr/0027): the
 * provider is asked first when the account or a secret changed, then the
 * sealed details are stored and every admin is told.
 *
 * Neither `store` nor a retention may be turned on for these workflows:
 * the execution would keep the sealed details in `workflow_execution`,
 * which outlives a disconnect.
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
    const { changes } = storeCredentialsStep(stored)
    const notice = transform({ input, changes }, ({ input, changes }) => ({
      provider: input.draft.provider,
      changes,
      actor_id: input.actor_id,
    }))
    notifyAccountChangeStep(notice)
    return new WorkflowResponse(checked)
  }
)
