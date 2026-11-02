import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { removeDemoOrdersWorkflow } from "../../workflows/demo/remove-demo-records"
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../seed/data"
import { isDemoOrder, isEmptyCategory } from "./select"
import type { CategoryRow, OrderRow } from "./select"

// Orders read and removed this many at a time
const PAGE = 200

type DemoOrderRow = OrderRow & { items?: ({ id: string } | null)[] | null }

/** The demo orders (seed:demo-orders), their reservations and invoices: soft-deleted. */
export async function removeDemoOrders(
  container: MedusaContainer
): Promise<{ orders: number; invoices: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const demo: DemoOrderRow[] = []
  // Everything is read before anything is removed, so the pages stay put
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "email", "metadata", "shipping_address.address_1", "items.id"],
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const rows = data as unknown as DemoOrderRow[]
    demo.push(...rows.filter(isDemoOrder))
    if (rows.length < PAGE) {
      break
    }
  }
  let invoices = 0
  for (let start = 0; start < demo.length; start += PAGE) {
    const batch = demo.slice(start, start + PAGE)
    const { result } = await removeDemoOrdersWorkflow(container).run({
      input: {
        order_ids: batch.map((order) => order.id),
        line_item_ids: batch.flatMap((order) =>
          (order.items ?? []).flatMap((item) => (item ? [item.id] : []))
        ),
      },
    })
    invoices += result.invoices
  }
  return { orders: demo.length, invoices }
}

/**
 * The demo products by their handles, one at a time through Medusa's own
 * workflow (variants, stock and links with them); one that cannot go (a
 * shopper's order still holds its stock) stays and is named.
 */
export async function removeDemoProducts(
  container: MedusaContainer
): Promise<{ removed: number; kept: string[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: DEMO_PRODUCTS.map((product) => product.handle) },
  })
  let removed = 0
  const kept: string[] = []
  for (const product of data) {
    try {
      await deleteProductsWorkflow(container).run({ input: { ids: [product.id] } })
      removed += 1
    } catch (error) {
      logger.warn({ event: "demo.product_kept", handle: product.handle, err: errorSummary(error) })
      kept.push(product.handle)
    }
  }
  return { removed, kept }
}

/** The demo categories once empty: one the shop put its own products or categories in stays. */
export async function removeDemoCategories(
  container: MedusaContainer
): Promise<{ removed: number; kept: string[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "products.id", "category_children.id"],
    filters: { handle: DEMO_CATEGORIES.map((category) => category.handle) },
  })
  const rows = data as unknown as CategoryRow[]
  const empty = rows.filter(isEmptyCategory)
  if (empty.length > 0) {
    await deleteProductCategoriesWorkflow(container).run({
      input: empty.map((category) => category.id),
    })
  }
  return {
    removed: empty.length,
    kept: rows.filter((category) => !isEmptyCategory(category)).map((category) => category.handle),
  }
}
