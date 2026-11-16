import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../lib/logging"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The cart's metadata key naming the link it was opened from; the server's alone (`qt_`).
 * Kept on the cart for the checkout and the storefront; the link's carts are looked up
 * through `payment_link_cart` (`completedLinkCarts`).
 */
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

interface Scope {
  /** The link's own condition, in both halves of the union (one link's, or none). */
  link: { kept: string; latest: string; values: string[] }
  /** The carts' condition, its bound values and the order. */
  scope: string
  values: (string | Date)[]
  order: string
}

/** The query's own conditions, their bound values and its order (fixed SQL, values bound). */
function scopeOf(by: { link_id: string } | { since: Date; after?: string }): Scope {
  if ("link_id" in by) {
    return {
      link: { kept: "AND plc.link_id = ?", latest: "AND pl.id = ?", values: [by.link_id] },
      scope: "",
      values: [],
      order: "c.completed_at ASC, x.cart_id",
    }
  }
  const link: Scope["link"] = { kept: "", latest: "", values: [] }
  if (by.after) {
    return {
      link,
      scope: "AND c.completed_at >= ? AND x.cart_id < ?",
      values: [by.since, by.after],
      order: "x.cart_id DESC",
    }
  }
  return { link, scope: "AND c.completed_at >= ?", values: [by.since], order: "x.cart_id DESC" }
}

/**
 * The completed carts opened from links (one link's oldest first): every cart a link
 * was ever bound to, not only its latest (a link names one cart; one it
 * gave up while that cart was completing may still have become an order).
 * Found through the payment links' own tables, then the carts read by
 * their ids: never by the carts' JSON metadata, which Medusa's `cart`
 * table does not index. The carts kept in `payment_link_cart` (by the
 * link's id, indexed), and with them each link's latest cart
 * (`payment_link.cart_id`): a cart opened while no row was written for it
 * (the code before the table, still serving during a deploy; a table
 * rolled back and made again) is seen all the same. Each with its order.
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
  const { link, scope, values, order } = scopeOf(by)
  const { rows } = await knex.raw<{ rows: { id: string; link_id: string }[] }>(
    `SELECT x.cart_id AS id, x.link_id
       FROM (SELECT plc.cart_id, plc.link_id
               FROM payment_link_cart plc
              WHERE plc.deleted_at IS NULL ${link.kept}
             UNION
             SELECT pl.cart_id, pl.id AS link_id
               FROM payment_link pl
              WHERE pl.deleted_at IS NULL AND pl.cart_id IS NOT NULL ${link.latest}) x
       JOIN cart c ON c.id = x.cart_id
      WHERE c.deleted_at IS NULL
        AND c.completed_at IS NOT NULL
        ${scope}
      ORDER BY ${order}
      LIMIT ?`,
    [...link.values, ...link.values, ...values, limit]
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
