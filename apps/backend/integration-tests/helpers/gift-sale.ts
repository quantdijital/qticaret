import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import type { StockShop } from "./stock"

/** adr/0025 Ek 2026-11-03: a gift card product sold on the storefront. */

export const BANK_TRANSFER = "pp_bank-transfer_bank-transfer"

let made = 0

/** A gift card product with a 250 and a 500 lira amount, made and marked as the panel does. */
export async function giftCardProduct(
  http: HttpClient,
  headers: Record<string, string>,
  shop: StockShop
): Promise<{ productId: string; variants: Record<"250" | "500", string>; marked: number }> {
  const { data } = await http.post<{
    product: { id: string; variants: { id: string; title: string }[] }
  }>(
    "/admin/products",
    {
      title: `Hediye Kartı ${String((made += 1))}`,
      status: "draft",
      options: [{ title: "Tutar", values: ["250 TL", "500 TL"] }],
      variants: ["250", "500"].map((amount) => ({
        title: `${amount} TL`,
        options: { Tutar: `${amount} TL` },
        manage_inventory: false,
        prices: [{ currency_code: "try", amount: Number(amount) }],
      })),
      sales_channels: [{ id: shop.salesChannelId }],
    },
    { headers }
  )
  const id = data.product.id
  const marked = await settle(
    http.post(`/admin/products/${id}/catalog`, { is_gift_card: true }, { headers })
  )
  // A product left physical (the mark refused) cannot be published without measurements
  await settle(http.post(`/admin/products/${id}`, { status: "published" }, { headers }))
  const variantOf = (title: string) =>
    data.product.variants.find((variant) => variant.title === title)?.id ?? ""
  return {
    productId: id,
    variants: { "250": variantOf("250 TL"), "500": variantOf("500 TL") },
    marked: marked.status,
  }
}

/** A guest's cart of `items`, addressed and with nothing to ship; its lines by variant. */
export async function giftCart(
  container: MedusaContainer,
  shop: StockShop,
  items: { variant_id: string; quantity: number }[]
): Promise<{ cartId: string; lineOf: (variantId: string) => string }> {
  const { result } = await createCartWorkflow(container).run({
    input: {
      region_id: shop.regionId,
      sales_channel_id: shop.salesChannelId,
      currency_code: "try",
      email: "ayse.yilmaz@example.com",
      items,
      shipping_address: PAYTR_ADDRESS,
      billing_address: PAYTR_ADDRESS,
    },
  })
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["items.id", "items.variant_id"],
    filters: { id: result.id },
  })
  const lines = (data[0] as { items: { id: string; variant_id: string }[] }).items
  return {
    cartId: result.id,
    lineOf: (variantId) => lines.find((line) => line.variant_id === variantId)?.id ?? "",
  }
}

/** The cards made for an order line, as the plugin keeps them. */
export async function cardsOfLine(container: MedusaContainer, lineId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "gift_card",
    fields: [
      "id",
      "code",
      "value",
      "currency_code",
      "reference_id",
      "store_credit_account.balance",
    ],
    filters: { line_item_id: lineId },
  })
  return data as unknown as {
    id: string
    code: string
    value: number
    reference_id: string
    store_credit_account: { balance: number }
  }[]
}

/** An order's lines with their metadata. */
export async function orderLines(container: MedusaContainer, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["items.id", "items.variant_id", "items.metadata"],
    filters: { id: orderId },
  })
  return (data[0] as { items: { id: string; variant_id: string; metadata: unknown }[] }).items
}
