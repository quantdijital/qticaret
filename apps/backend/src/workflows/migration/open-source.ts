import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { createShopifyApi, shopifyCredentialsOf } from "../../lib/migration/shopify/client"
import { openShopifySource } from "../../lib/migration/shopify/source"
import { bundleSource } from "../../lib/migration/sources/bundle"
import type { MigrationSource } from "../../lib/migration/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

type Container = Pick<MedusaContainer, "resolve">

export type SourceInput = { source: "bundle"; source_file_id: string } | { source: "shopify" }

/**
 * The run's source, opened (adr/0042 §1, §9): an uploaded bundle read
 * whole (its digest for the audit log), or the shop's Shopify store
 * through the account the owner connected; never details from the job's
 * input. `beat` keeps the job alive while Shopify works.
 */
export async function openSource(
  container: Container,
  input: SourceInput,
  beat: () => Promise<void>
): Promise<{ source: MigrationSource; digest: string | null }> {
  if (input.source === "bundle") {
    const buffer = await container.resolve(Modules.FILE).getAsBuffer(input.source_file_id)
    return {
      source: bundleSource(buffer),
      digest: createHash("sha256").update(buffer).digest("hex"),
    }
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("shopify")
  const credentials = account ? shopifyCredentialsOf(account) : null
  if (!credentials) {
    throw new ValidationError("migration.shopify_not_connected")
  }
  return {
    source: await openShopifySource(createShopifyApi(credentials), credentials.shopDomain, {
      beat,
    }),
    digest: null,
  }
}
