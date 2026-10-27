import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import { isCredentialProvider } from "../../../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"

/**
 * The shop's provider accounts (adr/0027 §6): state, settings and the
 * secrets' version number, read from the database. A secret, or any part
 * of one, never reaches the record: a changed key shows as a new version.
 */

async function snapshotOf(scope: Resolver, provider: string): Promise<Snapshot> {
  if (!isCredentialProvider(provider)) {
    return {}
  }
  const service = scope.resolve(
    INTEGRATION_CREDENTIALS_MODULE
  ) as IntegrationCredentialsModuleService
  const account = await service.describe(provider)
  const settings = Object.fromEntries(
    Object.entries(account.settings ?? {}).map(([key, value]) => [`settings.${key}`, value])
  )
  return { state: account.state, ...settings, secrets_version: account.secrets_version }
}

const PATH = String.raw`^\/admin\/integrations\/credentials\/(?<provider>[a-z0-9_]+)`

const resource = (method: string, route: string, suffix: string): AuditedResource => ({
  method,
  route,
  pattern: new RegExp(`${PATH}${suffix}$`, "i"),
  resourceType: "integration_credentials",
  resourceId: (params) => params["provider"] ?? null,
  snapshot: ({ scope, params }) => snapshotOf(scope, params["provider"] ?? ""),
})

export const INTEGRATION_RESOURCES: readonly AuditedResource[] = [
  resource("POST", "POST /admin/integrations/credentials/:provider", ""),
  resource("DELETE", "DELETE /admin/integrations/credentials/:provider", ""),
  resource("POST", "POST /admin/integrations/credentials/:provider/check", String.raw`\/check`),
]
