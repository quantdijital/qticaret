import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createLinksWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createLocationFulfillmentSetWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { updateWarehouseWorkflow } from "../../workflows/stock/warehouses"
import { TRY_CURRENCY_CODE, TR_COUNTRY_CODE } from "../bootstrap/constants"
import {
  DEMO_FULFILLMENT_SET_NAME,
  DEMO_METADATA,
  DEMO_SERVICE_ZONE_NAME,
  DEMO_SHIPPING_OPTIONS,
  DEMO_LOCATION_ADDRESS,
  MANUAL_FULFILLMENT_PROVIDER_ID,
} from "./data"

export interface DemoFulfillment {
  stockLocationId: string
  shippingProfileId: string
}

/**
 * The tenant's warehouse shipping to Turkey with the manual provider and
 * flat TRY shipping options. Each piece is created only when missing.
 */
export async function ensureDemoFulfillment(
  container: MedusaContainer,
  input: { regionId: string; salesChannelId: string; locationId: string }
): Promise<DemoFulfillment> {
  const stockLocationId = await ensureStockLocation(
    container,
    input.locationId,
    input.salesChannelId
  )
  const shippingProfileId = await ensureDefaultShippingProfile(container)
  const serviceZoneId = await ensureServiceZone(container, stockLocationId)
  await ensureShippingOptions(container, {
    regionId: input.regionId,
    serviceZoneId,
    shippingProfileId,
  })
  return { stockLocationId, shippingProfileId }
}

/**
 * The bootstrap's warehouse, with the demo address when it has none yet,
 * selling to the channel and shipping with the manual provider.
 */
async function ensureStockLocation(
  container: MedusaContainer,
  locationId: string,
  salesChannelId: string
): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.id", "sales_channels.id", "fulfillment_providers.id"],
    filters: { id: locationId },
  })
  const existing = data[0]
  const channelIds = (existing?.sales_channels ?? []).map((channel) => channel?.id)
  const providerIds = (existing?.fulfillment_providers ?? []).map((provider) => provider?.id)

  // Medusa's own update cannot give an address to a location without one
  if (existing && !existing.address) {
    await updateWarehouseWorkflow(container).run({
      input: { id: locationId, name: existing.name, address: DEMO_LOCATION_ADDRESS },
    })
  }
  if (!channelIds.includes(salesChannelId)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: locationId, add: [salesChannelId] },
    })
  }
  if (!providerIds.includes(MANUAL_FULFILLMENT_PROVIDER_ID)) {
    await createLinksWorkflow(container).run({
      input: [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: MANUAL_FULFILLMENT_PROVIDER_ID },
        },
      ],
    })
  }
  return locationId
}

async function ensureDefaultShippingProfile(container: MedusaContainer): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: "default" },
  })
  const existing = data[0]
  if (existing) {
    return existing.id
  }
  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: "Varsayılan", type: "default" }] },
  })
  const created = result[0]
  if (!created) {
    throw new Error("seed: createShippingProfilesWorkflow returned no profile")
  }
  return created.id
}

async function ensureServiceZone(container: MedusaContainer, stockLocationId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fetchSets = async () =>
    (
      await query.graph({
        entity: "fulfillment_set",
        fields: ["id", "service_zones.id", "service_zones.name"],
        filters: { name: DEMO_FULFILLMENT_SET_NAME },
      })
    ).data

  let fulfillmentSet = (await fetchSets())[0]
  if (!fulfillmentSet) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: stockLocationId,
        fulfillment_set_data: { name: DEMO_FULFILLMENT_SET_NAME, type: "shipping" },
      },
    })
    fulfillmentSet = (await fetchSets())[0]
  }
  if (!fulfillmentSet) {
    throw new Error("seed: fulfillment set was not created")
  }

  const zone = fulfillmentSet.service_zones.find((z) => z.name === DEMO_SERVICE_ZONE_NAME)
  if (zone) {
    return zone.id
  }
  const { result } = await createServiceZonesWorkflow(container).run({
    input: {
      data: [
        {
          fulfillment_set_id: fulfillmentSet.id,
          name: DEMO_SERVICE_ZONE_NAME,
          geo_zones: [{ type: "country", country_code: TR_COUNTRY_CODE }],
        },
      ],
    },
  })
  const created = result[0]
  if (!created) {
    throw new Error("seed: createServiceZonesWorkflow returned no zone")
  }
  return created.id
}

async function ensureShippingOptions(
  container: MedusaContainer,
  input: { regionId: string; serviceZoneId: string; shippingProfileId: string }
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existing } = await query.graph({
    entity: "shipping_option",
    fields: ["name"],
    filters: { service_zone_id: input.serviceZoneId },
  })
  const names = new Set(existing.map((option) => option.name))
  const missing = DEMO_SHIPPING_OPTIONS.filter((option) => !names.has(option.name))
  if (missing.length === 0) {
    return
  }

  await createShippingOptionsWorkflow(container).run({
    input: missing.map((option) => ({
      name: option.name,
      price_type: "flat",
      provider_id: MANUAL_FULFILLMENT_PROVIDER_ID,
      service_zone_id: input.serviceZoneId,
      shipping_profile_id: input.shippingProfileId,
      type: { label: option.name, description: option.description, code: option.code },
      // `demo:remove` takes only what carries it. The workflow's input type
      // leaves `metadata` out; the module stores it (seed-demo.spec.ts)
      metadata: { ...DEMO_METADATA },
      prices: [
        { currency_code: TRY_CURRENCY_CODE, amount: option.price },
        { region_id: input.regionId, amount: option.price },
      ],
      rules: [
        { attribute: "enabled_in_store", operator: "eq", value: "true" },
        { attribute: "is_return", operator: "eq", value: "false" },
      ],
    })),
  })
}
