import type { MedusaContainer } from "@medusajs/framework/types"
import { GA4_PROVIDER, META_PROVIDER } from "../../lib/conversions/client"
import { storefrontTrackingOf } from "../../lib/conversions/tracking"
import type { StorefrontTracking } from "../../lib/conversions/tracking"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

/**
 * The storefront's tag ids from the connected GA4 and Meta accounts (the
 * cached read the server's own events use); only the public ids leave.
 */
export async function storefrontTracking(
  container: Pick<MedusaContainer, "resolve">
): Promise<StorefrontTracking> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const [ga4, meta] = await Promise.all([
    credentials.read(GA4_PROVIDER),
    credentials.read(META_PROVIDER),
  ])
  return storefrontTrackingOf({ ga4, meta })
}
