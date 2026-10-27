import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
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

const serviceOf = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(INTEGRATION_CREDENTIALS_MODULE) as IntegrationCredentialsModuleService

/** Saves the sealed draft; a later failing step puts the account back as it was. */
export const storeCredentialsStep = createStep(
  "integration-credentials-store",
  async (input: StoreCredentialsInput, { container }) => {
    const previous = await serviceOf(container).store(
      input.draft,
      input.verification,
      input.actor_id
    )
    return new StepResponse(undefined, { provider: input.draft.provider, previous })
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo) {
      await serviceOf(container).restore(undo.provider, undo.previous)
    }
  }
)

/** Deletes the account; a later failing step puts it back. */
export const removeCredentialsStep = createStep(
  "integration-credentials-remove",
  async (provider: CredentialProviderName, { container }) => {
    const previous = await serviceOf(container).remove(provider)
    return new StepResponse(previous !== null, { provider, previous })
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo?.previous) {
      await serviceOf(container).restore(undo.provider, undo.previous)
    }
  }
)
