import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../modules/payment-links"
import type PaymentLinksModuleService from "../modules/payment-links/service"
import { CART_LINK_KEY } from "../workflows/payment-links/link-carts"

const BATCH = 500

type Container = Pick<MedusaContainer, "resolve">

/**
 * Every cart a link opened before `payment_link_cart` (Migration20261117090000)
 * is kept there too, from the link's mark on the cart (`qt_payment_link`), a
 * batch at a time by cart id. Only a mark naming a link that is there
 * counts. A cart already kept is left as it is, so the fill can run again
 * and changes nothing. Read only from the carts, every value bound. How
 * many marked carts it read, how many pairs it added and how many marks
 * named no link.
 */
export async function fillPaymentLinkCarts(
  container: Container,
  batch = BATCH
): Promise<{ read: number; added: number; skipped: number }> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  let read = 0
  let added = 0
  let skipped = 0
  let after = ""
  for (;;) {
    const { rows } = await knex.raw<{ rows: { id: string; link_id: string }[] }>(
      `SELECT c.id, c.metadata ->> ? AS link_id
         FROM cart c
        WHERE c.id > ?
          AND NULLIF(c.metadata ->> ?, '') IS NOT NULL
        ORDER BY c.id
        LIMIT ?`,
      [CART_LINK_KEY, after, CART_LINK_KEY, batch]
    )
    // Only a link that is there: a mark naming none is no link's cart
    const named = [...new Set(rows.map((row) => row.link_id))]
    const known = new Set(
      named.length > 0
        ? (await links.listPaymentLinks({ id: named }, { select: ["id"], take: null })).map(
            (link) => link.id
          )
        : []
    )
    const pairs = rows.flatMap((row) =>
      known.has(row.link_id) ? [{ link_id: row.link_id, cart_id: row.id }] : []
    )
    read += rows.length
    skipped += rows.length - pairs.length
    added += await links.recordLinkCarts(pairs)
    const last = rows[rows.length - 1]
    if (rows.length < batch || !last) {
      return { read, added, skipped }
    }
    after = last.id
  }
}

/**
 * Runs once per shop, on the `db:migrate` that brings `payment_link_cart`:
 * the links' earlier carts are kept there, so lookups through it (the
 * completion guard, the hourly settle, a link's reopening) see them. Run
 * it again, with nothing to lose, after the table is made anew (a rolled
 * back migration) or after carts were opened by code before the table:
 * `medusa exec ./src/migration-scripts/payment-link-carts.ts`.
 */
export default async function paymentLinkCarts({ container }: ExecArgs) {
  const { read, added, skipped } = await fillPaymentLinkCarts(container)
  logger.info({ event: "payment_links.carts_filled", read, added, skipped })
}
