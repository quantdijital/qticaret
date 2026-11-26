import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createLinksWorkflow } from "@medusajs/medusa/core-flows"
import {
  CARRIER_PROVIDERS,
  MANUAL_FULFILLMENT_PROVIDER_ID,
  SHOP_FULFILLMENT_PROVIDER_ID,
} from "../../lib/shipping/carriers"
import { logger } from "../../lib/logging"

/**
 * Our flat-price provider beside Medusa's manual one in every warehouse
 * that ships with it (adr/0087 §7): a "Kendi gönderimim" option of any
 * warehouse can move to it, not only the default's (security review
 * 2026-11-26).
 */
export async function ensureShopProviderWhereManual(container: MedusaContainer): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id"],
  })
  const rows = data as unknown as {
    id: string
    fulfillment_providers?: ({ id: string } | null)[] | null
  }[]
  const unlinked = rows.filter((row) => {
    const ids = (row.fulfillment_providers ?? []).flatMap((provider) =>
      provider ? [provider.id] : []
    )
    return (
      ids.includes(MANUAL_FULFILLMENT_PROVIDER_ID) && !ids.includes(SHOP_FULFILLMENT_PROVIDER_ID)
    )
  })
  if (unlinked.length === 0) {
    return
  }
  await createLinksWorkflow(container).run({
    input: unlinked.map((row) => ({
      [Modules.STOCK_LOCATION]: { stock_location_id: row.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: SHOP_FULFILLMENT_PROVIDER_ID },
    })),
  })
  logger.info(
    { event: "bootstrap.shop_provider_linked", locationIds: unlinked.map((row) => row.id) },
    "shop provider linked to locations"
  )
}

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
