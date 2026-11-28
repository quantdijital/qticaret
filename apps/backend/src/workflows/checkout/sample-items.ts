import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { isUnsellableSample } from "../../lib/sample-catalog/mark"

type Container = Pick<MedusaContainer, "resolve">

interface ItemInput {
  variant_id?: string | null | undefined
}

interface VariantRow {
  id: string
  product?: { id: string; metadata?: Record<string, unknown> | null } | null
}

/**
 * A sample product (the sector pack's sample catalogue, owner 2026-11-28)
 * is never sold: its variant goes into no cart, by the storefront's add,
 * a cart made with items, or a departure's booking route (which adds its
 * lines through the same workflow), nor into an order by staff (an order
 * edit's new lines, an exchange's new items). The mark is read here, on
 * the server; a product a load is still making counts (`isUnsellableSample`).
 */
export async function refuseSampleItems(
  container: Container,
  items: readonly ItemInput[] | null | undefined
): Promise<void> {
  const variantIds = [
    ...new Set((items ?? []).flatMap((item) => (item.variant_id ? [item.variant_id] : []))),
  ]
  if (variantIds.length === 0) {
    return
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "product.id", "product.metadata"],
    filters: { id: variantIds },
  })
  if (
    (data as VariantRow[]).some((variant) => variant.product && isUnsellableSample(variant.product))
  ) {
    throw new ValidationError("sample_catalog.not_for_sale", { field: "variant_id" })
  }
}

/**
 * The last word at checkout (security review 2026-11-28, D2): whatever way
 * a line came into the cart (a route this guard missed, a product marked
 * after it was added), a cart holding a sample is not completed.
 */
export async function refuseSampleCartLines(container: Container, cartId: string): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["items.variant_id"],
    filters: { id: cartId },
  })
  const cart = data[0] as { items?: ({ variant_id?: string | null } | null)[] | null } | undefined
  await refuseSampleItems(
    container,
    (cart?.items ?? []).flatMap((item) => (item ? [item] : []))
  )
}
