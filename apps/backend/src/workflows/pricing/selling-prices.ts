import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"

export interface VariantPrice {
  id: string
  calculated_price?: {
    calculated_amount?: number | null
    original_amount?: number | null
    calculated_price?: { price_list_id?: string | null } | null
  } | null
}

/**
 * What a shopper with no customer group pays now, per variant, in one
 * currency (ADR-0023): the price the history records and the storefront
 * shows. A variant with no price in the currency has no calculated amount.
 */
export async function sellingPrices(
  container: MedusaContainer,
  ids: string[],
  currency: string
): Promise<VariantPrice[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "calculated_price.calculated_amount",
      "calculated_price.original_amount",
      "calculated_price.calculated_price.price_list_id",
    ],
    filters: { id: ids },
    context: { calculated_price: QueryContext({ currency_code: currency }) },
  })
  return data
}

interface VariantShelf {
  id: string
  product?: {
    status?: string | null
    sales_channels?: ({ id: string } | null)[] | null
  } | null
}

/**
 * The variants a shopper may see (F4.3): of a published product, in one of
 * the publishable key's sales channels. A draft's or another channel's
 * price stays inside, as a variant that does not exist.
 */
export async function shopperVariantIds(
  container: MedusaContainer,
  ids: string[],
  salesChannelIds: readonly string[]
): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "product.status", "product.sales_channels.id"],
    filters: { id: ids },
  })
  const channels = new Set(salesChannelIds)
  return (data as VariantShelf[])
    .filter(
      (variant) =>
        variant.product?.status === "published" &&
        (variant.product.sales_channels ?? []).some(
          (channel) => channel && channels.has(channel.id)
        )
    )
    .map((variant) => variant.id)
}
