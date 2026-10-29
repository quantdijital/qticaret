import { MedusaService } from "@medusajs/framework/utils"
import { API_SCOPES } from "../../lib/api-access/scopes"
import type { ApiScope } from "../../lib/api-access/scopes"
import { ApiKeyScope } from "./models/api-key-scope"

const known = (scopes: readonly unknown[]): ApiScope[] =>
  scopes.filter((scope): scope is ApiScope => API_SCOPES.includes(scope as ApiScope))

/** API keys' scopes (F11.6): a key without a record reaches nothing. */
class ApiKeyScopesModuleService extends MedusaService({ ApiKeyScope }) {
  /** The key's scopes; none for a key we never scoped. */
  async scopesOf(apiKeyId: string): Promise<ApiScope[]> {
    const [row] = await this.listApiKeyScopes(
      { api_key_id: apiKeyId },
      { take: 1, select: ["scopes"] }
    )
    return known(row?.scopes ?? [])
  }

  /** Scopes of many keys, for the list. */
  async scopesOfMany(apiKeyIds: readonly string[]): Promise<Map<string, ApiScope[]>> {
    if (apiKeyIds.length === 0) {
      return new Map()
    }
    const rows = await this.listApiKeyScopes(
      { api_key_id: [...apiKeyIds] },
      { select: ["api_key_id", "scopes"] }
    )
    return new Map(rows.map((row) => [row.api_key_id, known(row.scopes)]))
  }
}

export default ApiKeyScopesModuleService
