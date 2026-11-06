import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { deleteApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import type { ApiScope } from "../../lib/api-access"
import { API_KEY_SCOPES_MODULE } from "../../modules/api-key-scopes"
import type ApiKeyScopesModuleService from "../../modules/api-key-scopes/service"
import { recordAuditEntryStep } from "../audit-log/steps/record-audit-entry"

export interface DeleteScopedApiKeyInput {
  id: string
  /** The person deleting it, and where from: written to the audit log. */
  actor_id: string
  request_id?: string | null | undefined
  ip?: string | null | undefined
  user_agent?: string | null | undefined
}

/** What the audit log keeps of a deleted key: never its token, only its masked form. */
export interface DeletedKey {
  id: string
  title: string
  redacted: string
}

/** A revoked key is gone for good; anything else must be revoked first. */
export const isDeletable = (revokedAt: Date | string | null | undefined, now = new Date()) =>
  revokedAt !== null && revokedAt !== undefined && new Date(revokedAt).getTime() <= now.getTime()

/**
 * The shop's secret key, revoked: Medusa deletes only a key whose
 * revocation has taken effect, and says so in its own words; ours is said
 * before anything is touched.
 */
export const loadRevokedKeyStep = createStep(
  "api-access-load-revoked-key",
  async (input: { id: string }, { container }) => {
    const [key] = await container
      .resolve(Modules.API_KEY)
      .listApiKeys({ id: input.id, type: "secret" }, { take: 1 })
    if (!key) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "api_key.unknown")
    }
    if (!isDeletable(key.revoked_at)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "api_key.delete_active")
    }
    return new StepResponse<DeletedKey>({ id: key.id, title: key.title, redacted: key.redacted })
  }
)

interface ScopeRow {
  api_key_id: string
  scopes: ApiScope[]
}

/** The key's scope row; put back as it was if the key itself cannot be deleted. */
export const deleteKeyScopesStep = createStep(
  "api-access-delete-key-scopes",
  async (input: { api_key_id: string }, { container }) => {
    const service = container.resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
    const rows = await service.listApiKeyScopes({ api_key_id: input.api_key_id })
    if (rows.length > 0) {
      await service.deleteApiKeyScopes(rows.map((row) => row.id))
    }
    const removed: ScopeRow[] = rows.map((row) => ({
      api_key_id: row.api_key_id,
      scopes: row.scopes as ApiScope[],
    }))
    return new StepResponse(removed.length, removed)
  },
  async (removed: ScopeRow[] | undefined, { container }) => {
    if (removed && removed.length > 0) {
      await container
        .resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
        .createApiKeyScopes(removed)
    }
  }
)

/**
 * A revoked API key removed from the list (F11.6): its scopes, then the
 * key through Medusa's workflow (which refuses one not yet revoked), then
 * an `api_key.deleted` entry naming it by title and masked token. What
 * the key did stays in the audit log; nothing there is deleted.
 */
export const deleteScopedApiKeyWorkflow = createWorkflow(
  "api-access-delete-key",
  (input: WorkflowData<DeleteScopedApiKeyInput>) => {
    const key = loadRevokedKeyStep(transform({ input }, ({ input }) => ({ id: input.id })))
    deleteKeyScopesStep(transform({ key }, ({ key }) => ({ api_key_id: key.id })))
    deleteApiKeysWorkflow.runAsStep({
      input: transform({ key }, ({ key }) => ({ ids: [key.id] })),
    })
    recordAuditEntryStep(
      transform({ input, key }, ({ input, key }) => ({
        kind: "mutation" as const,
        action: "api_key.deleted",
        actor_type: "user",
        actor_id: input.actor_id,
        resource_type: "api_key",
        resource_id: key.id,
        outcome: 200,
        changes: { title: key.title, redacted: key.redacted },
        request_id: input.request_id ?? null,
        ip: input.ip ?? null,
        user_agent: input.user_agent ?? null,
      }))
    )
    return new WorkflowResponse(key)
  }
)
