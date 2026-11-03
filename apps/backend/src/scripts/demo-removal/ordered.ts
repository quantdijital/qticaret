import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { removeOrderedDemoProductWorkflow } from "../../workflows/demo/remove-ordered-products"
import { DEMO_PRODUCTS } from "../seed/data"
import { findDemoCategories, removeDemoCategories } from "./catalog"
import { orderedDemoProducts } from "./select"
import type { OrderedDemoProduct, ProductStockRow, ReservationRow } from "./select"

// Reservations read this many at a time
const PAGE = 500

export interface OrderedRemovalSummary {
  /** Handles of the seed products removed. */
  products: string[]
  reservations: number
  /** Handles of those that still could not go (named in the log with why). */
  productsKept: string[]
  categories: number
  categoriesKept: string[]
}

async function reservationsOn(
  container: MedusaContainer,
  inventoryItemIds: string[]
): Promise<ReservationRow[]> {
  if (inventoryItemIds.length === 0) {
    return []
  }
  const inventory = container.resolve(Modules.INVENTORY)
  const rows: ReservationRow[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await inventory.listReservationItems(
      { inventory_item_id: inventoryItemIds },
      { select: ["id", "inventory_item_id"], skip, take: PAGE, order: { id: "ASC" } }
    )
    rows.push(...page.map(({ id, inventory_item_id }) => ({ id, inventory_item_id })))
    if (page.length < PAGE) {
      return rows
    }
  }
}

/**
 * The seed products still here, by the plain run's own rule (the seed's
 * mark, or no metadata and the seed's title), with the reservations on
 * their stock.
 */
export async function findOrderedDemoProducts(
  container: MedusaContainer
): Promise<OrderedDemoProduct[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata", "variants.inventory_items.inventory_item_id"],
    filters: { handle: DEMO_PRODUCTS.map((product) => product.handle) },
  })
  const products = data as unknown as ProductStockRow[]
  const items = products.flatMap((product) =>
    (product.variants ?? []).flatMap((variant) =>
      (variant?.inventory_items ?? []).flatMap((link) => link?.inventory_item_id ?? [])
    )
  )
  return orderedDemoProducts(products, await reservationsOn(container, [...new Set(items)]))
}

/**
 * `demo:remove products-with-orders` (a developer's machine only): the seed
 * products a shopper's order kept, each with its reservations released and
 * then soft-deleted, one at a time; then the demo categories left empty.
 * The orders keep their lines as written. Customers are not touched.
 */
export async function removeOrderedDemoProducts(
  container: MedusaContainer
): Promise<OrderedRemovalSummary> {
  const products = await findOrderedDemoProducts(container)
  for (const product of products) {
    logger.info({
      event: "demo.would_remove_ordered",
      id: product.id,
      label: product.label,
      reservations: product.reservation_ids.length,
    })
  }
  const removed: OrderedDemoProduct[] = []
  const productsKept: string[] = []
  for (const product of products) {
    try {
      await removeOrderedDemoProductWorkflow(container).run({
        input: { product_id: product.id, reservation_ids: product.reservation_ids },
      })
      removed.push(product)
    } catch (error) {
      logger.warn({ event: "demo.product_kept", handle: product.label, err: errorSummary(error) })
      productsKept.push(product.label)
    }
  }
  const categories = await findDemoCategories(
    container,
    new Set(removed.map((product) => product.id))
  )
  const emptied = await removeDemoCategories(container, categories.found)
  const summary: OrderedRemovalSummary = {
    products: removed.map((product) => product.label),
    reservations: removed.reduce((sum, product) => sum + product.reservation_ids.length, 0),
    productsKept,
    categories: emptied.removed,
    categoriesKept: [...categories.kept, ...emptied.kept],
  }
  logger.info(
    { event: "demo.ordered_products_removed", ...summary },
    "demo products held by orders removed"
  )
  return summary
}
