import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  firstOverLimit,
  purchaseLimitOf,
  withAdded,
  withChanged,
} from "../../lib/catalog/purchase-limit"
import type { LimitLine, VariantLimit } from "../../lib/catalog/purchase-limit"
import { ValidationError } from "../../lib/errors"

type Container = Pick<MedusaContainer, "resolve">

export const MAX_QUANTITY_REFUSAL = "cart.max_quantity"

interface VariantRow {
  id: string
  product_id?: string | null
  product?: {
    id: string
    title?: string | null
    product_extension?: { max_quantity?: number | null } | null
  } | null
}

interface CartItemRow {
  id: string
  variant_id?: string | null
  product_id?: string | null
  quantity?: unknown
}

/** Each variant's product and that product's limit, as stored now. */
async function variantLimits(
  container: Container,
  variantIds: readonly string[]
): Promise<Map<string, VariantLimit>> {
  const ids = [...new Set(variantIds)]
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "product_id",
      "product.id",
      "product.title",
      "product.product_extension.max_quantity",
    ],
    filters: { id: ids },
  })
  return new Map(
    (data as VariantRow[]).flatMap((variant) => {
      const productId = variant.product?.id ?? variant.product_id
      return productId
        ? [
            [
              variant.id,
              {
                product_id: productId,
                title: variant.product?.title ?? "",
                limit: purchaseLimitOf(variant.product?.product_extension?.max_quantity),
              },
            ] as const,
          ]
        : []
    })
  )
}

interface ProductRow {
  id: string
  title?: string | null
  product_extension?: { max_quantity?: number | null } | null
}

/**
 * Limits for lines whose variant the lookup did not find (deleted since it
 * was added), by the product the cart line names: no line escapes the count.
 */
async function addProductLimits(
  container: Container,
  lines: readonly LimitLine[],
  limits: Map<string, VariantLimit>
): Promise<void> {
  const orphans = lines.filter((line) => !limits.has(line.variant_id) && line.product_id)
  const ids = [...new Set(orphans.map((line) => line.product_id ?? ""))]
  if (ids.length === 0) {
    return
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "product_extension.max_quantity"],
    filters: { id: ids },
  })
  const products = new Map((data as ProductRow[]).map((product) => [product.id, product]))
  for (const line of orphans) {
    const product = products.get(line.product_id ?? "")
    if (product) {
      limits.set(line.variant_id, {
        product_id: product.id,
        title: product.title ?? "",
        limit: purchaseLimitOf(product.product_extension?.max_quantity),
      })
    }
  }
}

/** The cart's lines with a variant, as stored now. */
async function cartLines(container: Container, cartId: string): Promise<LimitLine[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["items.id", "items.variant_id", "items.product_id", "items.quantity"],
    filters: { id: cartId },
  })
  const items = (data[0] as { items?: (CartItemRow | null)[] | null } | undefined)?.items ?? []
  return items.flatMap((item) =>
    item?.variant_id
      ? [
          {
            id: item.id,
            variant_id: item.variant_id,
            product_id: item.product_id ?? undefined,
            quantity: Number(item.quantity ?? 0),
          },
        ]
      : []
  )
}

/** Refuses the lines when a product in them is past its limit (S5). */
async function assertLines(container: Container, lines: readonly LimitLine[]): Promise<void> {
  const limits = await variantLimits(
    container,
    lines.map((line) => line.variant_id)
  )
  await addProductLimits(container, lines, limits)
  const over = firstOverLimit(lines, limits)
  if (over) {
    throw new ValidationError(MAX_QUANTITY_REFUSAL, {
      field: "quantity",
      values: { title: over.title, limit: String(over.limit) },
    })
  }
}

interface AddedItem {
  variant_id?: string | null | undefined
  quantity?: unknown
}

const addedLines = (items: readonly AddedItem[] | null | undefined): LimitLine[] =>
  (items ?? []).flatMap((item) =>
    item.variant_id ? [{ variant_id: item.variant_id, quantity: Number(item.quantity ?? 1) }] : []
  )

/** Lines added to a cart (`addToCartWorkflow`), with what it already holds. */
export async function assertAddWithinLimits(
  container: Container,
  cartId: string,
  items: readonly AddedItem[] | null | undefined
): Promise<void> {
  const added = addedLines(items)
  if (added.length === 0) {
    return
  }
  await assertLines(container, withAdded(await cartLines(container, cartId), added))
}

/** A cart made with lines (`createCartWorkflow`). */
export async function assertNewCartWithinLimits(
  container: Container,
  items: readonly AddedItem[] | null | undefined
): Promise<void> {
  const added = addedLines(items)
  if (added.length > 0) {
    await assertLines(container, added)
  }
}

/** A line's count raised (`updateLineItemInCartWorkflow`); lowering it always passes. */
export async function assertChangeWithinLimits(
  container: Container,
  cartId: string,
  itemId: string,
  quantity: unknown
): Promise<void> {
  const wanted = Number(quantity)
  if (!Number.isFinite(wanted) || wanted <= 0) {
    return
  }
  const lines = withChanged(await cartLines(container, cartId), itemId, wanted)
  if (lines) {
    await assertLines(container, lines)
  }
}

/** The whole cart as it completes: whatever way its lines came. */
export async function assertCartWithinLimits(container: Container, cartId: string): Promise<void> {
  await assertLines(container, await cartLines(container, cartId))
}
