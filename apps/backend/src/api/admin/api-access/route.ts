import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { API_KEY_SCOPES_MODULE } from "../../../modules/api-key-scopes"
import type ApiKeyScopesModuleService from "../../../modules/api-key-scopes/service"
import { createScopedApiKeyWorkflow } from "../../../workflows/api-access/create-api-key"
import type { AdminPostApiKeyType } from "./validators"

interface KeyRow {
  id: string
  title: string
  redacted: string
  created_at: Date | string
  revoked_at: Date | string | null
}

/** A key as the panel lists it: masked, never its token. */
const view = (key: KeyRow, scopes: readonly string[]) => ({
  id: key.id,
  title: key.title,
  redacted: key.redacted,
  created_at: key.created_at,
  revoked_at: key.revoked_at ?? null,
  scopes,
})

/** GET /admin/api-access (F11.6): the shop's secret API keys, masked, with their scopes. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const keys = (await req.scope
    .resolve(Modules.API_KEY)
    .listApiKeys(
      { type: "secret" },
      { order: { created_at: "DESC" }, take: 200 }
    )) as unknown as KeyRow[]
  const scopes = await req.scope
    .resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
    .scopesOfMany(keys.map((key) => key.id))
  res.json({ keys: keys.map((key) => view(key, scopes.get(key.id) ?? [])) })
}

/**
 * POST /admin/api-access: a new key and its scopes; its token is in this
 * answer only (Medusa keeps a hash). Recorded in the audit log as every
 * admin write; the token never is (only the request is recorded).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostApiKeyType>,
  res: MedusaResponse
): Promise<void> {
  const { title, scopes } = req.validatedBody
  const { result } = await createScopedApiKeyWorkflow(req.scope).run({
    input: { title, scopes, created_by: req.auth_context.actor_id },
  })
  const key = result as unknown as KeyRow & { token: string }
  res.status(201).json({ key: view(key, scopes), token: key.token })
}
