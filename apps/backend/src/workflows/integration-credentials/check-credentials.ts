import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { checkStoredAccountStep } from "./steps/check-stored"
import { guardAiOwnKeysStep } from "./steps/guard-ai-own-keys"

/** "Test the connection" from the panel (adr/0027 §4); an AI service only under `ai.own_keys`. */
export const checkIntegrationCredentialsWorkflow = createWorkflow(
  "integration-credentials-check",
  (provider: CredentialProviderName) => {
    guardAiOwnKeysStep(provider)
    return new WorkflowResponse(checkStoredAccountStep(provider))
  }
)
