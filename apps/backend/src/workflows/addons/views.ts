import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { lineAddonsOf, storedAddonsOf } from "../../lib/catalog/addons"

type Container = Pick<MedusaContainer, "resolve">

/** A cart line after its add-ons changed: its price now and what it records of them. */
export async function addonLineView(container: Container, cartId: string, lineId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.compare_at_unit_price",
      "items.is_custom_price",
      "items.metadata",
    ],
    filters: { id: cartId },
  })
  const items = (data[0] as { items?: (Record<string, unknown> | null)[] | null } | undefined)
    ?.items
  const line = (items ?? []).find((item) => item?.["id"] === lineId)
  if (!line) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.line_unknown")
  }
  return {
    id: lineId,
    quantity: Number(line["quantity"]),
    unit_price: Number(line["unit_price"]),
    compare_at_unit_price:
      line["compare_at_unit_price"] === null || line["compare_at_unit_price"] === undefined
        ? null
        : Number(line["compare_at_unit_price"]),
    is_custom_price: line["is_custom_price"] === true,
    addons: lineAddonsOf(line["metadata"]),
  }
}

interface ProductRow {
  status?: string | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { addons?: unknown } | null
}

/**
 * GET /store/products/:id/addons (adr/0052 §3): the add-ons a published
 * product of this storefront offers, prices in lira per unit, for the
 * product page's form and its running total (which only shows: the
 * server prices the line). Another product reads as unknown.
 */
export async function storeProductAddons(
  container: Container,
  productId: string,
  salesChannelIds: readonly string[]
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "status", "sales_channels.id", "product_extension.addons"],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  const listed = (product?.sales_channels ?? []).some((channel) =>
    salesChannelIds.includes(channel?.id ?? "")
  )
  if (product?.status !== "published" || !listed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  return storedAddonsOf(product.product_extension?.addons ?? null)
}
