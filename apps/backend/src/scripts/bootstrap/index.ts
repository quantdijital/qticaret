import type { MedusaContainer } from "@medusajs/framework/types"
import { ensureAdminLayouts } from "./admin-layout"
import { ensureDefaultLocation } from "./location"
import { ensureLocationCarriers } from "./location-carriers"
import { ensureTrRegion } from "./region"
import { ensureStoreDefaults } from "./store"
import { ensureVatRates } from "./tax"

/**
 * Configures an empty Medusa instance for Turkey (F1.1, F1.2), its first
 * warehouse (F3.7) and its admin menus (adr/0021). Idempotent:
 * every step looks up what exists first, so provisioning can rerun it after a
 * partial failure. Each core workflow it calls rolls back its own changes.
 */
export async function bootstrapTenant(
  container: MedusaContainer
): Promise<{ regionId: string; locationId: string }> {
  const regionId = await ensureTrRegion(container)
  await ensureStoreDefaults(container, regionId)
  const locationId = await ensureDefaultLocation(container)
  await ensureLocationCarriers(container)
  await ensureVatRates(container)
  await ensureAdminLayouts(container)
  return { regionId, locationId }
}
