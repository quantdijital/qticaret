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
 * batch at a time by cart id. A pair already kept is left as it is, so the
 * fill can run again and changes nothing. Read only from the carts, every
 * value bound. How many carts it read and how many pairs it added.
 */
export async function fillPaymentLinkCarts(
  container: Container,
  batch = BATCH
): Promise<{ read: number; added: number }> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  let read = 0
  let added = 0
  let after = ""
  for (;;) {
    const { rows } = await knex.raw<{ rows: { id: string; link_id: string }[] }>(
      `SELECT id, metadata ->> ? AS link_id
         FROM cart
        WHERE id > ?
          AND NULLIF(metadata ->> ?, '') IS NOT NULL
        ORDER BY id
        LIMIT ?`,
      [CART_LINK_KEY, after, CART_LINK_KEY, batch]
    )
    read += rows.length
    added += await links.recordLinkCarts(
      rows.map((row) => ({ link_id: row.link_id, cart_id: row.id }))
    )
    const last = rows[rows.length - 1]
    if (rows.length < batch || !last) {
      return { read, added }
    }
    after = last.id
  }
}

/**
 * Runs once per shop, on the `db:migrate` that brings `payment_link_cart`:
 * the links' earlier carts are kept there, so lookups through it (the
 * completion guard, the hourly settle, a link's reopening) see them.
 */
export default async function paymentLinkCarts({ container }: ExecArgs) {
  const { read, added } = await fillPaymentLinkCarts(container)
  logger.info({ event: "payment_links.carts_filled", read, added })
}
