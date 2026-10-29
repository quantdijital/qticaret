import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import type { ApiScope } from "../../lib/api-access"
import { API_KEY_SCOPES_MODULE } from "../../modules/api-key-scopes"
import type ApiKeyScopesModuleService from "../../modules/api-key-scopes/service"

/** The key's scopes; undone, they go with it. */
const recordScopesStep = createStep(
  "api-access-record-scopes",
  async (input: { api_key_id: string; scopes: ApiScope[] }, { container }) => {
    const row = await container
      .resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
      .createApiKeyScopes({ api_key_id: input.api_key_id, scopes: input.scopes })
    return new StepResponse(row.id, row.id)
  },
  async (id: string | undefined, { container }) => {
    if (id) {
      await container
        .resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
        .deleteApiKeyScopes(id)
    }
  }
)

/**
 * A secret API key for the shop's own systems (F11.6, adr/0039 §6), with
 * what it may reach. Medusa's workflow makes the key (its token is in this
 * result only) and undoes it if the scopes cannot be kept.
 */
export const createScopedApiKeyWorkflow = createWorkflow(
  "api-access-create-key",
  (input: WorkflowData<{ title: string; scopes: ApiScope[]; created_by: string }>) => {
    const keys = createApiKeysWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        api_keys: [{ title: input.title, type: "secret" as const, created_by: input.created_by }],
      })),
    })
    const key = transform({ keys }, ({ keys }) => keys[0])
    recordScopesStep(
      transform({ input, key }, ({ input, key }) => ({
        api_key_id: key?.id ?? "",
        scopes: input.scopes,
      }))
    )
    return new WorkflowResponse(key)
  }
)
