import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createLinksWorkflow } from "@medusajs/medusa/core-flows"
import { GELIVER_FULFILLMENT_PROVIDER_ID } from "../../lib/shipping/carriers"
import { logger } from "../../lib/logging"

/**
 * The carriers a warehouse ships with (adr/0031): Geliver joins the
 * shop's default location, so a shipping option can use it once the shop
 * connects its account. Only when missing; Medusa's manual provider is
 * the seed's business.
 */
export async function ensureLocationCarriers(container: MedusaContainer): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({ entity: "store", fields: ["default_location_id"] })
  const locationId = (stores[0] as { default_location_id?: string | null } | undefined)
    ?.default_location_id
  if (!locationId) {
    return
  }
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["fulfillment_providers.id"],
    filters: { id: locationId },
  })
  const linked = (
    (data[0] as { fulfillment_providers?: ({ id: string } | null)[] } | undefined)
      ?.fulfillment_providers ?? []
  ).some((provider) => provider?.id === GELIVER_FULFILLMENT_PROVIDER_ID)
  if (linked) {
    return
  }
  await createLinksWorkflow(container).run({
    input: [
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: GELIVER_FULFILLMENT_PROVIDER_ID },
      },
    ],
  })
  logger.info(
    { event: "bootstrap.location_carrier_linked", locationId },
    "Geliver linked to location"
  )
}
