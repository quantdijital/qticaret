import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { logger } from "../../lib/logging"
import { LAYOUT_LIMITS } from "../../lib/storefront/layout"

/**
 * The shop's best sellers (adr/0049 Ek 2026-11-05): products by the units
 * sold over the last days, in one statement over Medusa's order tables.
 *
 * - An order counts when it is a sale (not a draft, archived or canceled
 *   one) and paid: its payment taken or held, as the panel's "paid" reads
 *   it (lib/dashboard/lifecycle), and not refunded in full; or completed.
 * - A line counts its units now (the order's current version: an edit that
 *   took units off counts them off), less those returned and received.
 * - Only products shown in the shopper's sales channels: published, not
 *   deleted, in one of them.
 * - Most units first; equal ones the most recently sold first.
 *
 * Held a few minutes per window and channels: a rail does not follow each
 * order, and the public layout read never runs it more often than that.
 */

const DAY_MS = 24 * 60 * 60 * 1000

// Payment taken or held (Medusa's payment collection statuses)
const PAID = ["authorized", "partially_authorized", "partially_captured", "completed"]
const NOT_SALES = ["draft", "archived", "canceled"]

const quoted = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ")

// Every value from outside is bound; the lists above are the statement's own
const UNITS = "GREATEST(oi.quantity - oi.return_received_quantity, 0)"

// The product is in one of the shopper's sales channels (their ids bound as one JSON list)
const IN_CHANNELS = `
   AND EXISTS (
         SELECT 1 FROM product_sales_channel psc
          WHERE psc.product_id = p.id AND psc.deleted_at IS NULL
            AND psc.sales_channel_id = ANY(ARRAY(SELECT jsonb_array_elements_text(?::jsonb))))`

/** The sales the rankings count, from the window on (one bound value), per product. */
function salesBody(channels: boolean): string {
  return `
  FROM "order" o
  JOIN order_item oi ON oi.order_id = o.id AND oi.version = o.version AND oi.deleted_at IS NULL
  JOIN order_line_item li ON li.id = oi.item_id AND li.deleted_at IS NULL
  JOIN product p ON p.id = li.product_id AND p.status = 'published' AND p.deleted_at IS NULL
 WHERE o.deleted_at IS NULL
   AND o.canceled_at IS NULL
   AND o.is_draft_order = false
   AND o.status::text NOT IN (${quoted(NOT_SALES)})
   AND o.created_at >= ?
   AND (o.status::text = 'completed' OR EXISTS (
         SELECT 1
           FROM order_payment_collection opc
           JOIN payment_collection pc
             ON pc.id = opc.payment_collection_id AND pc.deleted_at IS NULL
          WHERE opc.order_id = o.id AND opc.deleted_at IS NULL
            AND pc.status IN (${quoted(PAID)})
            AND NOT (coalesce(pc.captured_amount, 0) > 0
                     AND coalesce(pc.refunded_amount, 0) >= pc.captured_amount)))${channels ? IN_CHANNELS : ""}
 GROUP BY li.product_id`
}

/** The statement; `channels` adds the sales channel condition. */
export function bestSellersStatement(channels: boolean): string {
  return `SELECT li.product_id${salesBody(channels)}
HAVING sum(${UNITS}) > 0
 ORDER BY sum(${UNITS}) DESC, max(o.created_at) DESC, li.product_id
 LIMIT ?`
}

/**
 * The most products "Çok satan" holds at once: a bound on what one held
 * read keeps in memory, far past a shop whose threshold still means
 * something. Past it the most sold are kept and the log says so, once.
 */
export const SOLD_AT_LEAST_CAP = 5000

/**
 * The products that sold at least a number of units over the window, the
 * same sales as the ranking's, most sold first: the window, the least and
 * the most rows (all bound). Only ids: no order, customer or amount leaves
 * the statement.
 */
export function soldAtLeastStatement(): string {
  return `SELECT li.product_id${salesBody(false)}
HAVING sum(${UNITS}) >= ?
 ORDER BY sum(${UNITS}) DESC, li.product_id
 LIMIT ?`
}

/** The ranked products of the last `days`, at most a rail's most (`LAYOUT_LIMITS.items`). */
async function readBestSellers(
  container: Pick<MedusaContainer, "resolve">,
  days: number,
  channels: readonly string[] | null,
  now: Date
): Promise<string[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const since = new Date(now.getTime() - days * DAY_MS)
  const params: (string | number | Date)[] = [since]
  if (channels) {
    params.push(JSON.stringify([...new Set(channels)]))
  }
  params.push(LAYOUT_LIMITS.items)
  const result = await knex.raw<{ rows: { product_id: string }[] }>(
    bestSellersStatement(channels !== null),
    params
  )
  return result.rows.map((row) => row.product_id)
}

// A rail does not follow each order: the ranking is held a few minutes
export const BEST_SELLERS_TTL_MS = 5 * 60_000
const held = createTtlCache<string[]>({ ttlMs: BEST_SELLERS_TTL_MS, maxEntries: 32 })

/** The best sellers of the last `days` shown in these sales channels (null: any), most units first. */
export function bestSellerIds(
  container: Pick<MedusaContainer, "resolve">,
  days: number,
  channels: readonly string[] | null,
  now: Date = new Date()
): Promise<string[]> {
  const key = `${String(days)}|${channels ? [...new Set(channels)].sort().join(",") : "*"}`
  return held(key, () => readBestSellers(container, days, channels, now))
}

// A card's "Çok satan" (product badges) follows the sales as loosely as the rail
const sold = createTtlCache<ReadonlySet<string>>({ ttlMs: BEST_SELLERS_TTL_MS, maxEntries: 8 })

// The cap's warning, once a process: a threshold set too low says so without filling the log
let capLogged = false

/**
 * The shop's products that sold at least `minUnits` units over the last
 * `days`, whatever the channel (the card's own read keeps to the
 * shopper's): one statement for the whole shop, held a few minutes per
 * window and least, so a page of cards never asks per product.
 */
export function soldAtLeastIds(
  container: Pick<MedusaContainer, "resolve">,
  days: number,
  minUnits: number,
  now: Date = new Date()
): Promise<ReadonlySet<string>> {
  return sold(`${String(days)}|${String(minUnits)}`, async () => {
    const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
    const since = new Date(now.getTime() - days * DAY_MS)
    // One past the cap tells a full answer from one cut short
    const result = await knex.raw<{ rows: { product_id: string }[] }>(soldAtLeastStatement(), [
      since,
      minUnits,
      SOLD_AT_LEAST_CAP + 1,
    ])
    if (result.rows.length > SOLD_AT_LEAST_CAP && !capLogged) {
      capLogged = true
      logger.warn({
        event: "storefront.best_seller_cap",
        cap: SOLD_AT_LEAST_CAP,
        min_units: minUnits,
      })
    }
    return new Set(result.rows.slice(0, SOLD_AT_LEAST_CAP).map((row) => row.product_id))
  })
}
