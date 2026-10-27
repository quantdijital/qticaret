import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import { accountChanges } from "../../../modules/integration-credentials/rules"
import type {
  CredentialDraft,
  StoredCredential,
  Verification,
  default as IntegrationCredentialsModuleService,
} from "../../../modules/integration-credentials/service"

export interface StoreCredentialsInput {
  draft: CredentialDraft
  verification: Verification | null
  actor_id: string | null
}

interface Undo {
  provider: CredentialProviderName
  previous: StoredCredential | null
}

const serviceOf = (container: MedusaContainer) =>
  container.resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)

/**
 * Saves the sealed draft and says what changed (for the shop's alert); a
 * later failing step puts the account back as it was.
 */
export const storeCredentialsStep = createStep(
  "integration-credentials-store",
  async (input: StoreCredentialsInput, { container }) => {
    const { draft } = input
    const previous = await serviceOf(container).store(draft, input.verification, input.actor_id)
    return new StepResponse(
      { changes: accountChanges(draft.provider, previous, draft) },
      { provider: draft.provider, previous }
    )
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo) {
      await serviceOf(container).restore(undo.provider, undo.previous)
    }
  }
)

/** Deletes the account; a later failing step puts it back. */
export const removeCredentialsStep = createStep(
  "integration-credentials-delete",
  async (provider: CredentialProviderName, { container }) => {
    const previous = await serviceOf(container).remove(provider)
    return new StepResponse(
      { changes: accountChanges(provider, previous, null) },
      { provider, previous }
    )
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo?.previous) {
      await serviceOf(container).restore(undo.provider, undo.previous)
    }
  }
)
