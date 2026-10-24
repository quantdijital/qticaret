import type { MedusaContainer } from "@medusajs/framework/types"
import { ensureTrRegion } from "./region"
import { ensureStoreDefaults } from "./store"
import { ensureVatRates } from "./tax"

/**
 * Configures an empty Medusa instance for Turkey (F1.1, F1.2). Idempotent:
 * every step looks up what exists first, so provisioning can rerun it after a
 * partial failure. Each core workflow it calls rolls back its own changes.
 */
export async function bootstrapTenant(container: MedusaContainer): Promise<{ regionId: string }> {
  const regionId = await ensureTrRegion(container)
  await ensureStoreDefaults(container, regionId)
  await ensureVatRates(container)
  return { regionId }
}
