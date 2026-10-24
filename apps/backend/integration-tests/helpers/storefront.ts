import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

export interface Storefront {
  salesChannelId: string
  /** Header set for Store API requests. */
  headers: { "x-publishable-api-key": string }
}

/** Publishable key bound to the store's default sales channel. */
export async function createStorefront(container: MedusaContainer): Promise<Storefront> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["default_sales_channel_id"],
  })
  const salesChannelId = stores[0]?.default_sales_channel_id
  if (!salesChannelId) {
    throw new Error("test store has no default sales channel")
  }

  const { result } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "integration test", type: "publishable", created_by: "" }] },
  })
  const key = result[0]
  if (!key) {
    throw new Error("createApiKeysWorkflow returned no key")
  }
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: key.id, add: [salesChannelId] },
  })

  return { salesChannelId, headers: { "x-publishable-api-key": key.token } }
}

export interface TestProductInput {
  handle: string
  /** Gross TRY price, KDV included. */
  price: number
  typeId?: string
}

/** Single-variant published product without inventory tracking; returns the variant id. */
export async function createTestProduct(
  container: MedusaContainer,
  salesChannelId: string,
  input: TestProductInput
): Promise<string> {
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: input.handle,
          handle: input.handle,
          status: "published",
          ...(input.typeId ? { type_id: input.typeId } : {}),
          options: [{ title: "Seçenek", values: ["Standart"] }],
          variants: [
            {
              title: "Standart",
              options: { Seçenek: "Standart" },
              manage_inventory: false,
              prices: [{ currency_code: "try", amount: input.price }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
      ],
    },
  })
  const variantId = result[0]?.variants[0]?.id
  if (!variantId) {
    throw new Error("createProductsWorkflow returned no variant")
  }
  return variantId
}
