import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { trackingScopes } from "../../lib/conversions/tracking"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { notifyAccountChangeStep } from "./steps/notify-account-change"
import { removeCredentialsStep } from "./steps/store-credentials"

export interface RemoveCredentialsInput {
  provider: CredentialProviderName
  actor_id: string | null
}

/**
 * Disconnects a provider: its stored account is deleted outright and every
 * admin is told (adr/0027 §6); GA4's or Meta's tag leaves the storefront
 * at once. No `store` or retention (see the save workflow).
 */
export const removeIntegrationCredentialsWorkflow = createWorkflow(
  "integration-credentials-remove",
  (input: RemoveCredentialsInput) => {
    const { changes } = removeCredentialsStep(input.provider)
    const notice = transform({ input, changes }, ({ input, changes }) => ({
      provider: input.provider,
      changes,
      actor_id: input.actor_id,
    }))
    notifyAccountChangeStep(notice)
    refreshStorefrontStep(transform({ input }, ({ input }) => trackingScopes(input.provider)))
    return new WorkflowResponse(changes)
  }
)
