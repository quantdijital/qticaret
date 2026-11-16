import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../lib/logging"

type Container = Pick<MedusaContainer, "resolve">

/** The cart's metadata key naming the link it was opened from; the server's alone (`qt_`). */
export const CART_LINK_KEY = "qt_payment_link"

/** A completed cart opened from a link, and the order it became (null when none shows). */
export interface LinkCart {
  cart_id: string
  link_id: string
  order_id: string | null
}

interface CartRow {
  id: string
  completed_at?: Date | string | null
  order?: { id: string } | null
}

/**
 * The carts that became orders, by cart: the order's id. A cart marked
 * completed whose order does not show is logged (its link stays open for
 * staff while the customer cannot open it) and kept with null.
 */
export async function placedOrders(
  container: Container,
  cartIds: string[]
): Promise<Map<string, string | null>> {
  if (cartIds.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "order.id"],
    filters: { id: cartIds },
  })
  const placed = new Map<string, string | null>()
  for (const cart of data as CartRow[]) {
    if (cart.order?.id) {
      placed.set(cart.id, cart.order.id)
    } else if (cart.completed_at) {
      logger.warn({ event: "payment_links.completed_cart_without_order", cartId: cart.id })
      placed.set(cart.id, null)
    }
  }
  return placed
}

/**
 * The completed carts opened from links (one link's oldest first): every cart a link
 * was ever bound to, not only its latest (a link names one cart; one it
 * gave up while that cart was completing may still have become an order).
 * Read straight from the carts' metadata (a JSON key the typed query cannot
 * filter on); writes go through the modules. Each with its order.
 *
 * Those completed since a time come a page at a time, newest cart id first
 * (Medusa's ids sort by their making): `after` is the last id of the page
 * before (a key every page moves past exactly).
 */
export async function completedLinkCarts(
  container: Container,
  by: { link_id: string } | { since: Date; after?: string },
  limit = 500
): Promise<LinkCart[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  let scope = "AND metadata ->> ? = ?"
  let values: (string | Date)[] = []
  let order = "completed_at ASC, id"
  if ("link_id" in by) {
    values = [CART_LINK_KEY, by.link_id]
  } else {
    scope = by.after ? "AND completed_at >= ? AND id < ?" : "AND completed_at >= ?"
    values = by.after ? [by.since, by.after] : [by.since]
    order = "id DESC"
  }
  const { rows } = await knex.raw<{ rows: { id: string; link_id: string }[] }>(
    `SELECT id, metadata ->> ? AS link_id
       FROM cart
      WHERE deleted_at IS NULL
        AND completed_at IS NOT NULL
        AND metadata ->> ? IS NOT NULL
        ${scope}
      ORDER BY ${order}
      LIMIT ?`,
    [CART_LINK_KEY, CART_LINK_KEY, ...values, limit]
  )
  const orders = await placedOrders(
    container,
    rows.map((row) => row.id)
  )
  return rows.map((row) => ({
    cart_id: row.id,
    link_id: row.link_id,
    order_id: orders.get(row.id) ?? null,
  }))
}
