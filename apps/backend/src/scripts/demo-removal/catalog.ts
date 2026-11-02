import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { removeDemoOrdersWorkflow } from "../../workflows/demo/remove-demo-records"
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../seed/data"
import type { DemoRemovalPlan, PlannedRecord } from "./plan"
import { isDemoCategory, isDemoOrder, isDemoProduct, isEmptyCategory } from "./select"
import type { CategoryRow, OrderRow, ProductRow } from "./select"

// Orders read and removed this many at a time
const PAGE = 200

type DemoOrderRow = OrderRow & { items?: ({ id: string } | null)[] | null }

/** The demo orders (seed:demo-orders), each with its line items. */
export async function findDemoOrders(
  container: MedusaContainer
): Promise<DemoRemovalPlan["orders"]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const demo: DemoRemovalPlan["orders"] = []
  // Everything is read before anything is removed, so the pages stay put
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "email", "metadata", "shipping_address.address_1", "items.id"],
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const rows = data as unknown as DemoOrderRow[]
    for (const order of rows.filter(isDemoOrder)) {
      demo.push({
        id: order.id,
        line_item_ids: (order.items ?? []).flatMap((item) => (item ? [item.id] : [])),
      })
    }
    if (rows.length < PAGE) {
      break
    }
  }
  return demo
}

/** The planned demo orders, their reservations and invoices: soft-deleted. */
export async function removeDemoOrders(
  container: MedusaContainer,
  orders: DemoRemovalPlan["orders"]
): Promise<{ orders: number; invoices: number }> {
  let invoices = 0
  for (let start = 0; start < orders.length; start += PAGE) {
    const batch = orders.slice(start, start + PAGE)
    const { result } = await removeDemoOrdersWorkflow(container).run({
      input: {
        order_ids: batch.map((order) => order.id),
        line_item_ids: batch.flatMap((order) => order.line_item_ids),
      },
    })
    invoices += result.invoices
  }
  return { orders: orders.length, invoices }
}

/**
 * The products the seed made: a demo handle and the seed's mark (or, made
 * before it, no metadata and the seed's title). Another record with a demo
 * handle is the shop's: named, kept.
 */
export async function findDemoProducts(
  container: MedusaContainer
): Promise<{ found: PlannedRecord[]; skipped: string[] }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata"],
    filters: { handle: DEMO_PRODUCTS.map((product) => product.handle) },
  })
  const rows = data as unknown as ProductRow[]
  return {
    found: rows.filter(isDemoProduct).map((row) => ({ id: row.id, label: row.handle })),
    skipped: rows.filter((row) => !isDemoProduct(row)).map((row) => row.handle),
  }
}

/**
 * The planned products, one at a time through Medusa's own workflow
 * (variants, stock and links with them); one that cannot go (a shopper's
 * order still holds its stock) stays and is named.
 */
export async function removeDemoProducts(
  container: MedusaContainer,
  products: readonly PlannedRecord[]
): Promise<{ removed: number; kept: string[] }> {
  let removed = 0
  const kept: string[] = []
  for (const product of products) {
    try {
      await deleteProductsWorkflow(container).run({ input: { ids: [product.id] } })
      removed += 1
    } catch (error) {
      logger.warn({ event: "demo.product_kept", handle: product.label, err: errorSummary(error) })
      kept.push(product.label)
    }
  }
  return { removed, kept }
}

/**
 * The categories the seed made (its mark, or no metadata and the seed's
 * name) that are empty once the planned products are gone; one holding the
 * shop's own products or categories is kept.
 */
export async function findDemoCategories(
  container: MedusaContainer,
  going: ReadonlySet<string>
): Promise<{ found: PlannedRecord[]; kept: string[]; skipped: string[] }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "handle", "name", "metadata", "products.id", "category_children.id"],
    filters: { handle: DEMO_CATEGORIES.map((category) => category.handle) },
  })
  const rows = data as unknown as CategoryRow[]
  const demo = rows.filter(isDemoCategory)
  return {
    found: demo
      .filter((category) => isEmptyCategory(category, going))
      .map((category) => ({ id: category.id, label: category.handle })),
    kept: demo.filter((category) => !isEmptyCategory(category, going)).map((row) => row.handle),
    skipped: rows.filter((category) => !isDemoCategory(category)).map((row) => row.handle),
  }
}

/** The planned categories that are empty now (a product that could not go keeps its own). */
export async function removeDemoCategories(
  container: MedusaContainer,
  categories: readonly PlannedRecord[]
): Promise<{ removed: number; kept: string[] }> {
  if (categories.length === 0) {
    return { removed: 0, kept: [] }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "handle", "products.id", "category_children.id"],
    filters: { id: categories.map((category) => category.id) },
  })
  const rows = data as unknown as CategoryRow[]
  const empty = rows.filter((category) => isEmptyCategory(category))
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
