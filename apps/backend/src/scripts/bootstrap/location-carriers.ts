import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createLinksWorkflow } from "@medusajs/medusa/core-flows"
import { CARRIER_PROVIDERS, SHOP_FULFILLMENT_PROVIDER_ID } from "../../lib/shipping/carriers"
import { logger } from "../../lib/logging"

/**
 * The carriers a warehouse ships with (adr/0031, adr/0035): every carrier
 * provider the app registers joins the shop's default location, so a
 * shipping option can use it once the shop connects its account. Only the
 * missing ones; Medusa's manual provider is the seed's business. Our
 * own flat-price provider (`shop_shop`, adr/0087) joins it too.
 */
export async function ensureLocationCarriers(container: MedusaContainer): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({ entity: "store", fields: ["default_location_id"] })
  const locationId = (stores[0] as { default_location_id?: string | null } | undefined)
    ?.default_location_id
  if (!locationId) {
    return
  }
  const [{ data }, registered] = await Promise.all([
    query.graph({
      entity: "stock_location",
      fields: ["fulfillment_providers.id"],
      filters: { id: locationId },
    }),
    container
      .resolve(Modules.FULFILLMENT)
      .listFulfillmentProviders(
        { id: [...CARRIER_PROVIDERS, SHOP_FULFILLMENT_PROVIDER_ID] },
        { select: ["id"] }
      ),
  ])
  const linked = new Set(
    (
      (data[0] as { fulfillment_providers?: ({ id: string } | null)[] } | undefined)
        ?.fulfillment_providers ?? []
    ).flatMap((provider) => (provider ? [provider.id] : []))
  )
  const missing = registered.map((provider) => provider.id).filter((id) => !linked.has(id))
  if (missing.length === 0) {
    return
  }
  await createLinksWorkflow(container).run({
    input: missing.map((providerId) => ({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
    })),
  })
  logger.info(
    { event: "bootstrap.location_carrier_linked", locationId, providers: missing },
    "carriers linked to location"
  )
}
