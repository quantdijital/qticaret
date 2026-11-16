import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { BACKORDER_MARK } from "../../src/lib/stock/backorder"
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
    // The seed's standard option, whatever order the database returns them in
    query.graph({ entity: "shipping_option", fields: ["id"], filters: { name: "Standart Kargo" } }),
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
 * admin does. Its price is `price` lira, tax included.
 */
export async function stockedProduct(
  container: MedusaContainer,
  shop: StockShop,
  handle: string,
  quantity: number | null,
  price = 100
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
              prices: [{ currency_code: "try", amount: price }],
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

/** One `createReservationItems` call seen while `failOrderLineReservation` watches. */
export interface ReservationCall {
  line_item_ids: (string | null)[]
  /** The units of an order's lines of the watched variant: the completion's own hold. */
  order_line: boolean
  rejected: boolean
}

/**
 * Fails the first reservation of an order's lines of `variantId` with
 * `error`, passing every other `createReservationItems` call through, and
 * records each. Medusa v2.21.2's completeCartWorkflow reserves in
 * `reserve-inventory-step`, after `createOrdersStep`, with the new order's
 * line ids as `line_item_id`; those lines are read back to know the call.
 */
export function failOrderLineReservation(
  container: MedusaContainer,
  variantId: string,
  error: Error
): { calls: ReservationCall[]; restore: () => void } {
  const inventory = container.resolve(Modules.INVENTORY)
  const orders = container.resolve(Modules.ORDER)
  const create = inventory.createReservationItems.bind(inventory)
  const calls: ReservationCall[] = []
  const spy = jest
    .spyOn(inventory, "createReservationItems")
    .mockImplementation(async (...args: Parameters<typeof create>) => {
      const [input] = args
      const items: { line_item_id?: string | null }[] = Array.isArray(input) ? input : [input]
      const ids = items.map((item) => item.line_item_id ?? null)
      const named = ids.filter((id): id is string => id !== null)
      const lines =
        named.length > 0 && named.length === ids.length
          ? await orders.listOrderLineItems({ id: named }, { select: ["id", "variant_id"] })
          : []
      // Every line an order's, of the watched variant; a cart's line or another product's is not
      const orderLine =
        lines.length > 0 &&
        lines.length === new Set(named).size &&
        lines.every((line) => line.variant_id === variantId)
      const rejected = orderLine && !calls.some((call) => call.rejected)
      calls.push({ line_item_ids: ids, order_line: orderLine, rejected })
      return rejected ? Promise.reject(error) : create(...args)
    })
  return {
    calls,
    restore: () => {
      spy.mockRestore()
    },
  }
}

export async function firstLineOf(container: MedusaContainer, orderId: string): Promise<string> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
  return (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
}

export interface OrderRow {
  id: string
  display_id: number
  metadata: Record<string, unknown> | null
  items: { id: string }[]
}

/** The order as the stock-short checks read it: its number, metadata and line ids. */
export async function orderRowOf(container: MedusaContainer, orderId: string): Promise<OrderRow> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "metadata", "items.id"],
    filters: { id: orderId },
  })
  const row: unknown = data[0]
  return row as OrderRow
}

/** The item's level at the location: on the shelf, held, and whether a raise is marked on it. */
export async function shelfOf(
  container: MedusaContainer,
  itemId: string,
  locationId: string
): Promise<{ stocked: number; reserved: number; marked: boolean }> {
  const [level] = await container
    .resolve(Modules.INVENTORY)
    .listInventoryLevels(
      { inventory_item_id: itemId, location_id: locationId },
      { select: ["stocked_quantity", "reserved_quantity", "metadata"] }
    )
  return {
    stocked: Number(level?.stocked_quantity),
    reserved: Number(level?.reserved_quantity),
    marked: Boolean(level?.metadata?.[BACKORDER_MARK]),
  }
}

/** How many reservations hold the item, at any location. */
export async function holdsOf(container: MedusaContainer, itemId: string): Promise<number> {
  const held = await container
    .resolve(Modules.INVENTORY)
    .listReservationItems({ inventory_item_id: itemId }, { select: ["id"] })
  return held.length
}
