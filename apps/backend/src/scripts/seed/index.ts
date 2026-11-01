import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { bootstrapTenant } from "../bootstrap"
import { ensureDemoCatalog } from "./catalog"
import { DEMO_PUBLISHABLE_KEY_TITLE } from "./data"
import { ensureDemoFulfillment } from "./fulfillment"
import { ensureDemoStorefront } from "./storefront"

export interface DemoSeedResult {
  regionId: string
  salesChannelId: string
  publishableKeyId: string
}

/**
 * Demo store for development and sales demos (F1.6). Runs the tenant
 * bootstrap first, then adds only what is missing, so it can be rerun.
 */
export async function seedDemo(container: MedusaContainer): Promise<DemoSeedResult> {
  const { regionId, locationId } = await bootstrapTenant(container)
  const salesChannelId = await defaultSalesChannelId(container)
  const publishableKeyId = await ensurePublishableKey(container, salesChannelId)

  const fulfillment = await ensureDemoFulfillment(container, {
    regionId,
    salesChannelId,
    locationId,
  })
  await ensureDemoCatalog(container, { salesChannelId, ...fulfillment })
  await ensureDemoStorefront(container)

  return { regionId, salesChannelId, publishableKeyId }
}

async function defaultSalesChannelId(container: MedusaContainer): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const id = data[0]?.default_sales_channel_id
  if (!id) {
    throw new Error("seed: store has no default sales channel")
  }
  return id
}

async function ensurePublishableKey(
  container: MedusaContainer,
  salesChannelId: string
): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "sales_channels.id"],
    filters: { title: DEMO_PUBLISHABLE_KEY_TITLE, type: "publishable" },
  })

  let keyId = data[0]?.id
  const isLinked = (data[0]?.sales_channels ?? []).some((channel) => channel?.id === salesChannelId)
  if (!keyId) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: DEMO_PUBLISHABLE_KEY_TITLE, type: "publishable", created_by: "" }],
      },
    })
    keyId = result[0]?.id
    if (!keyId) {
      throw new Error("seed: createApiKeysWorkflow returned no key")
    }
  }
  if (!isLinked) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: keyId, add: [salesChannelId] },
    })
  }
  return keyId
}
