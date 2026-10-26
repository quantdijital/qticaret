import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { seedDemo } from "../../src/scripts/seed"
import { placeOrder } from "../../src/scripts/seed/orders/place"

/** The demo shop's checkout pieces (F1.6 seed): region, channel, warehouse, shipping. */
export interface StockShop {
  regionId: string
  salesChannelId: string
  locationId: string
  shippingOptionId: string
  shippingProfileId: string
}

export async function stockShop(container: MedusaContainer): Promise<StockShop> {
  const { regionId, salesChannelId } = await seedDemo(container)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: stores }, { data: options }, { data: profiles }] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_location_id"] }),
    query.graph({ entity: "shipping_option", fields: ["id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type: "default" } }),
  ])
  return {
    regionId,
    salesChannelId,
    locationId: (stores[0] as { default_location_id: string }).default_location_id,
    shippingOptionId: (options[0] as { id: string }).id,
    shippingProfileId: (profiles[0] as { id: string }).id,
  }
}

/**
 * A product tracking its stock, with `quantity` on the shelf at the shop's
 * warehouse; null leaves it with no stock level at all, as Medusa's own
 * admin does.
 */
export async function stockedProduct(
  container: MedusaContainer,
  shop: StockShop,
  handle: string,
  quantity: number | null
): Promise<{ productId: string; variantId: string; itemId: string }> {
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: handle,
          handle,
          status: "published",
          weight: 500,
          length: 20,
          width: 10,
          height: 5,
          shipping_profile_id: shop.shippingProfileId,
          options: [{ title: "Seçenek", values: ["Standart"] }],
          variants: [
            {
              title: "Standart",
              options: { Seçenek: "Standart" },
              manage_inventory: true,
              prices: [{ currency_code: "try", amount: 100 }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
      ],
    },
  })
  const productId = result[0]?.id ?? ""
  const variantId = result[0]?.variants[0]?.id ?? ""
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["inventory_items.inventory_item_id"],
    filters: { id: variantId },
  })
  const itemId = (data[0] as { inventory_items: { inventory_item_id: string }[] })
    .inventory_items[0]?.inventory_item_id
  if (!itemId) {
    throw new Error("variant has no inventory item")
  }
  if (quantity === null) {
    return { productId, variantId, itemId }
  }
  // As the stock page does: through Medusa's workflow, which tells the stock ledger
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: [
        { inventory_item_id: itemId, location_id: shop.locationId, stocked_quantity: quantity },
      ],
    },
  })
  return { productId, variantId, itemId }
}

/** One unit of the variant, ordered as a shopper does. */
export const orderOne = (container: MedusaContainer, shop: StockShop, variantId: string) =>
  placeOrder(container, {
    ...shop,
    items: [{ variant_id: variantId, quantity: 1 }],
    address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
  })

export async function firstLineOf(container: MedusaContainer, orderId: string): Promise<string> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
  return (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
}
