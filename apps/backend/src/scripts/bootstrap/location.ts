import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import { DEFAULT_STOCK_LOCATION_NAME } from "./constants"

interface StoreRow {
  id: string
  default_location_id?: string | null
  default_sales_channel_id?: string | null
}

interface LocationRow {
  id: string
  sales_channels?: ({ id: string } | null)[] | null
}

async function existingLocation(
  container: MedusaContainer,
  id: string | null | undefined
): Promise<LocationRow | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "sales_channels.id"],
    // The oldest one when the store names none
    ...(id ? { filters: { id } } : { pagination: { take: 1, order: { created_at: "ASC" } } }),
  })
  return (data[0] as LocationRow | undefined) ?? null
}

/**
 * A warehouse to keep stock in (F3.7): the store's default location, made
 * when the store has none (an existing location becomes the default) and
 * selling to the default sales channel, which checkout reserves from. Its
 * address is the shop's to fill in, in the panel. Each piece only when
 * missing, so a rerun keeps the shop's choices.
 */
export async function ensureDefaultLocation(container: MedusaContainer): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_location_id", "default_sales_channel_id"],
  })
  const store = stores[0] as StoreRow | undefined
  if (!store) {
    throw new Error("bootstrap: no store found; start the server once so Medusa creates it")
  }

  // The store's default, or the oldest location when it names none (or a deleted one)
  let location = await existingLocation(container, store.default_location_id)
  if (!location && store.default_location_id) {
    location = await existingLocation(container, null)
  }
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [{ name: DEFAULT_STOCK_LOCATION_NAME }] },
    })
    const created = result[0]
    if (!created) {
      throw new Error("bootstrap: createStockLocationsWorkflow returned no location")
    }
    location = { id: created.id, sales_channels: [] }
    logger.info({ event: "bootstrap.location_created", locationId: created.id }, "created location")
  }
  if (store.default_location_id !== location.id) {
    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: { default_location_id: location.id } },
    })
    logger.info(
      { event: "bootstrap.default_location_set", locationId: location.id },
      "default location set"
    )
  } else {
    logger.info(
      { event: "bootstrap.location_kept", locationId: location.id },
      "default location exists, keeping it"
    )
  }

  const channelId = store.default_sales_channel_id
  const isLinked = (location.sales_channels ?? []).some((channel) => channel?.id === channelId)
  if (channelId && !isLinked) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [channelId] },
    })
  }
  return location.id
}
