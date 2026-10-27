import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"

/**
 * Adds a payment provider to every region, next to the providers each has.
 * Medusa replaces a region's whole set when given one, so each region's own
 * set is read and kept. For the migration script a provider arrives with.
 */
export async function addRegionPaymentProvider(
  container: MedusaContainer,
  providerId: string
): Promise<void> {
  const { data: regions } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
  })
  for (const region of regions as { id: string; payment_providers?: ({ id: string } | null)[] }[]) {
    const current = (region.payment_providers ?? []).flatMap((provider) =>
      provider ? [provider.id] : []
    )
    if (current.includes(providerId)) {
      continue
    }
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: { payment_providers: [...current, providerId] },
      },
    })
    logger.info({ event: "migration.region_payment_provider", regionId: region.id, providerId })
  }
}
