import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { replacesUnchecked } from "../../../lib/ai/account-check"
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
 * the workflow with the field to fix, and so does an answer the provider
 * gives out of its documentation. An unreachable provider lets a first
 * connection be saved as "not checked", but never replaces an account
 * that works: payments would stop on details nobody checked (except a
 * service whose check is not documented enough, `replacesUnchecked`:
 * there a refused key alone stops the save). An `unconfirmed` answer (a
 * provider that can refuse details but never confirm them: PTT) is saved
 * as "not verified" and the panel warns. The draft is opened here and
 * nowhere kept.
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
    const check = await checkAccount(draft.provider, await service.openDraft(draft))
    if (check === "merchant_invalid" || check === "secret_invalid") {
      throw new ValidationError(`${draft.provider}.${check}`, {
        field: CHECK_FIELDS[draft.provider][check],
      })
    }
    if (check === "failed") {
      throw new ValidationError("integration_credentials.check_failed")
    }
    if (check === "unreachable" && draft.connected && !replacesUnchecked(draft.provider)) {
      throw new ValidationError("integration_credentials.provider_unreachable")
    }
    return new StepResponse<CheckedDraft>({
      verification: check === "valid" ? "verified" : "unverified",
      check,
    })
  }
)
