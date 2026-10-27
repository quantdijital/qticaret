import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { removeCredentialsStep } from "./steps/store-credentials"

/** Disconnects a provider: its stored account is deleted outright (adr/0027 §6). */
export const removeIntegrationCredentialsWorkflow = createWorkflow(
  "integration-credentials-remove",
  (provider: CredentialProviderName) => new WorkflowResponse(removeCredentialsStep(provider))
)
