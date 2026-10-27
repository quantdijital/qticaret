import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { CHECK_FIELDS, checkAccount } from "../../../lib/integrations/account-check"
import type { AccountCheck } from "../../../lib/integrations/account-check"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type {
  CredentialDraft,
  Verification,
  default as IntegrationCredentialsModuleService,
} from "../../../modules/integration-credentials/service"

export interface CheckedDraft {
  /** null: nothing that names the account changed, the stored result stands. */
  verification: Verification | null
  check: AccountCheck | null
}

/**
 * Asks the provider before a save (adr/0027 §4). Details it refuses stop
 * the workflow with the field to fix; an unreachable provider lets the
 * save go on as "not checked". The draft is opened here and nowhere kept.
 */
export const checkDraftStep = createStep(
  "integration-credentials-check-draft",
  async (draft: CredentialDraft, { container }) => {
    if (!draft.needs_check) {
      return new StepResponse<CheckedDraft>({ verification: null, check: null })
    }
    const service = container.resolve<IntegrationCredentialsModuleService>(
      INTEGRATION_CREDENTIALS_MODULE
    )
    const check = await checkAccount(draft.provider, service.openDraft(draft))
    if (check === "merchant_invalid" || check === "secret_invalid") {
      const field = CHECK_FIELDS[draft.provider]?.[check]
      throw new ValidationError(`${draft.provider}.${check}`, field ? { field } : {})
    }
    return new StepResponse<CheckedDraft>({
      verification: check === "valid" ? "verified" : "unverified",
      check,
    })
  }
)
