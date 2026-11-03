import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import { isOpen, linkNumber, shownStatus } from "../../lib/payment-links/snapshot"
import type { PaymentLinkDiscount, PaymentLinkLine } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"

type Container = Pick<MedusaContainer, "resolve">

/** A link row as the module returns it. */
export interface LinkRow {
  id: string
  number: number
  status: string
  expires_at: Date | string
  token_ends_at: Date | string
  created_by: string
  customer_id: string | null
  sealed: string | null
  lines: unknown
  discount: unknown
  shipping_option_id: string | null
  note: string | null
  currency_code: string
  items_total: number
  discount_total: number
  cart_id: string | null
  order_id: string | null
  opened_count: number
  last_opened_at: Date | string | null
  sent_count: number
  last_sent_at: Date | string | null
  paid_at: Date | string | null
  canceled_by: string | null
  closed_at: Date | string | null
  created_at: Date | string
}

export const linesOf = (link: { lines: unknown }): PaymentLinkLine[] =>
  Array.isArray(link.lines) ? (link.lines as PaymentLinkLine[]) : []

export const discountOf = (link: { discount: unknown }): PaymentLinkDiscount | null =>
  link.discount && typeof link.discount === "object" ? (link.discount as PaymentLinkDiscount) : null

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** Staff members' names by user id. */
export type StaffNames = ReadonlyMap<string, string>

/**
 * Who made or canceled links, by name, as an order's notes name their
 * authors: first and last name, never the e-mail. Someone no longer on
 * the team, or without a name, is left out (the panel shows a dash).
 */
export async function staffNames(
  container: Container,
  ids: readonly (string | null)[]
): Promise<StaffNames> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) {
    return new Map()
  }
  const users = await container
    .resolve(Modules.USER)
    .listUsers({ id: wanted }, { select: ["id", "first_name", "last_name"], take: wanted.length })
  return new Map(
    users.flatMap((user) => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
      return name ? [[user.id, name] as const] : []
    })
  )
}

/**
 * A list row (adr/0051 §13): the customer masked, what was offered, where
 * it stands (past its end it reads `expired`, whatever the row says until
 * the hourly job), who made it.
 */
export function linkSummary(
  container: Container,
  link: LinkRow,
  names: StaffNames,
  now = new Date()
) {
  const contact = service(container).openPrivate(link.sealed)?.contact
  const email = contact?.email ? normalizeRecipient("email", contact.email) : null
  const discount = discountOf(link)
  return {
    id: link.id,
    number: linkNumber(link.number),
    status: shownStatus(link, now),
    customer: {
      id: link.customer_id,
      name: contact
        ? `${contact.first_name} ${contact.last_name.slice(0, 1)}${contact.last_name ? "." : ""}`.trim()
        : null,
      email: email ? maskRecipient("email", email) : null,
    },
    items_total: link.items_total,
    discount_total: link.discount_total,
    total: link.items_total - link.discount_total,
    discount: discount
      ? {
          type: discount.type,
          value: discount.value,
          amount: discount.amount,
          reason: discount.reason,
        }
      : null,
    currency_code: link.currency_code,
    created_by: link.created_by,
    created_by_name: names.get(link.created_by) ?? null,
    created_at: link.created_at,
    expires_at: link.expires_at,
    opened_count: link.opened_count,
    sent_count: link.sent_count,
    order_id: link.order_id,
  }
}

/** The link's page in the panel: its customer in full (a recorded read), its lines and note. */
export function linkDetail(container: Container, link: LinkRow, names: StaffNames) {
  const sealed = service(container).openPrivate(link.sealed)
  return {
    ...linkSummary(container, link, names),
    contact: sealed?.contact ?? null,
    address: sealed?.address ?? null,
    lines: linesOf(link).map((line) => ({ ...line, total: line.unit_price * line.quantity })),
    shipping_option_id: link.shipping_option_id,
    note: link.note,
    token_ends_at: link.token_ends_at,
    cart_id: link.cart_id,
    last_opened_at: link.last_opened_at,
    last_sent_at: link.last_sent_at,
    paid_at: link.paid_at,
    canceled_by: link.canceled_by,
    canceled_by_name: link.canceled_by ? (names.get(link.canceled_by) ?? null) : null,
    closed_at: link.closed_at,
  }
}

/** List rows with the names of who made them, one read of the team for the page. */
export async function linkSummaries(container: Container, links: readonly LinkRow[]) {
  const names = await staffNames(
    container,
    links.map((link) => link.created_by)
  )
  const now = new Date()
  return links.map((link) => linkSummary(container, link, names, now))
}

/** The link's page with the names of who made and who canceled it. */
export async function linkDetailView(container: Container, link: LinkRow) {
  return linkDetail(
    container,
    link,
    await staffNames(container, [link.created_by, link.canceled_by])
  )
}

/**
 * What the customer's page shows (adr/0051 §3): the lines, totals, whether
 * shipping is set, the end. Of the person, the first name only. A link
 * whose prices moved says so; it opens no cart.
 */
export function publicLinkView(
  container: Container,
  link: LinkRow,
  short: ReadonlySet<string>,
  now = new Date()
) {
  const contact = service(container).openPrivate(link.sealed)?.contact
  return {
    number: linkNumber(link.number),
    state: isOpen(link, now) ? "open" : "prices_changed",
    first_name: contact?.first_name ?? null,
    currency_code: link.currency_code,
    lines: linesOf(link).map((line) => ({
      variant_id: line.variant_id,
      title: line.title,
      variant_title: line.variant_title,
      thumbnail: line.thumbnail,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total: line.unit_price * line.quantity,
      in_stock: !short.has(line.variant_id),
    })),
    items_total: link.items_total,
    discount_total: link.discount_total,
    total: link.items_total - link.discount_total,
    shipping: { preset: link.shipping_option_id !== null },
    expires_at: link.expires_at,
  }
}
