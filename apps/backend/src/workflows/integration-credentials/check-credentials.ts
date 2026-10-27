import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { checkStoredAccountStep } from "./steps/check-stored"

/** "Test the connection" from the panel (adr/0027 §4). */
export const checkIntegrationCredentialsWorkflow = createWorkflow(
  "integration-credentials-check",
  (provider: CredentialProviderName) => new WorkflowResponse(checkStoredAccountStep(provider))
)
