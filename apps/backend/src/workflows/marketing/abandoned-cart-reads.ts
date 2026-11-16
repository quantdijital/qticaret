import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { CART_REMINDERS_MODULE } from "../../modules/cart-reminders"
import type CartRemindersModuleService from "../../modules/cart-reminders/service"
import { brandOf } from "../messaging/brand"
import { channelFacts } from "./abandoned-cart-consents"
import {
  ABANDONED_AFTER_MS,
  ABANDONED_WINDOW_DAYS,
  emailReminderBlock,
  whatsappNumber,
} from "./abandoned-cart-facts"
import type { AbandonedCartDetail, AbandonedCartRow } from "./abandoned-cart-facts"
import { remindedLately } from "./cart-reminders"

export type { AbandonedCartDetail, AbandonedCartRow } from "./abandoned-cart-facts"

type Container = Pick<MedusaContainer, "resolve">

const DAY_MS = 24 * 60 * 60 * 1000
/** Lines a list row shows; the dialog shows them all. */
const ROW_LINES = 3

// Carts with lines and a way to reach their shopper, not an order, not a
// payment link's (the team made those; found in the links' own tables, the carts kept
// and each link's latest, not by the cart's metadata), untouched for an hour but within
// the window, whose shopper has placed no order since. Values bound.
const WHERE = `
  FROM cart c
  LEFT JOIN cart_address a ON a.id = c.shipping_address_id AND a.deleted_at IS NULL
 WHERE c.deleted_at IS NULL
   AND c.completed_at IS NULL
   AND c.updated_at < ? AND c.updated_at >= ?
   AND (NULLIF(btrim(c.email), '') IS NOT NULL OR NULLIF(btrim(a.phone), '') IS NOT NULL)
   AND NOT EXISTS (
         SELECT 1 FROM payment_link_cart plc WHERE plc.cart_id = c.id AND plc.deleted_at IS NULL)
   AND NOT EXISTS (
         SELECT 1 FROM payment_link pl WHERE pl.cart_id = c.id AND pl.deleted_at IS NULL)
   AND EXISTS (SELECT 1 FROM cart_line_item li WHERE li.cart_id = c.id AND li.deleted_at IS NULL)
   AND NOT EXISTS (
         SELECT 1 FROM "order" o
          WHERE o.deleted_at IS NULL AND c.email IS NOT NULL
            AND lower(o.email) = lower(c.email) AND o.created_at > c.updated_at)`

interface CartRecord {
  id: string
  email: string | null
  customer_id: string | null
  currency_code: string
  total: MedusaAmount
  updated_at: string | Date
  completed_at: string | Date | null
  shipping_address: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  } | null
  items:
    | ({
        title?: string | null
        product_title?: string | null
        variant_title?: string | null
        quantity: MedusaAmount
        thumbnail?: string | null
      } | null)[]
    | null
}

interface CustomerRecord {
  id: string
  first_name: string | null
  last_name: string | null
  has_account: boolean
}

const fullName = (first?: string | null, last?: string | null): string | null =>
  [first, last]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ") || null

const phoneOf = (cart: CartRecord): string | null => {
  const raw = cart.shipping_address?.phone?.trim() ?? ""
  return raw === "" ? null : (normalizeRecipient("sms", raw) ?? raw)
}

/** The carts by id with what a row shows, in the order asked. */
async function hydrate(container: Container, ids: string[]) {
  if (ids.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    // Medusa works out the totals only when the cart's own is asked for
    fields: [
      "id",
      "email",
      "customer_id",
      "currency_code",
      "total",
      "updated_at",
      "completed_at",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.phone",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.quantity",
      "items.thumbnail",
    ],
    filters: { id: ids },
  })
  const carts = data as unknown as CartRecord[]
  const customerIds = [
    ...new Set(carts.flatMap((cart) => (cart.customer_id ? [cart.customer_id] : []))),
  ]
  const { data: customerRows } =
    customerIds.length === 0
      ? { data: [] }
      : await query.graph({
          entity: "customer",
          fields: ["id", "first_name", "last_name", "has_account"],
          filters: { id: customerIds },
        })
  const customers = new Map((customerRows as CustomerRecord[]).map((row) => [row.id, row]))
  const reminders = await container
    .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
    .listCartReminders(
      { cart_id: ids },
      { select: ["cart_id", "outcome", "created_at", "returned_at"], take: ids.length }
    )
  const reminderOf = new Map(reminders.map((row) => [row.cart_id, row]))
  const [email, sms] = await Promise.all([
    channelFacts(
      container,
      "email",
      carts.map((cart) => cart.email)
    ),
    channelFacts(container, "sms", carts.map(phoneOf)),
  ])
  const byId = new Map(carts.map((cart) => [cart.id, cart]))
  return ids.flatMap((id) => {
    const cart = byId.get(id)
    if (!cart) {
      return []
    }
    const customer = cart.customer_id ? customers.get(cart.customer_id) : undefined
    const phone = phoneOf(cart)
    const normalized = phone ? normalizeRecipient("sms", phone) : null
    const reminder = reminderOf.get(id)
    const emailFacts = cart.email ? email.get(cart.email) : undefined
    const smsFacts = phone ? sms.get(phone) : undefined
    const lines = (cart.items ?? []).filter((item) => item !== null)
    const row: AbandonedCartRow = {
      id,
      name:
        fullName(cart.shipping_address?.first_name, cart.shipping_address?.last_name) ??
        (customer ? fullName(customer.first_name, customer.last_name) : null),
      email: cart.email,
      phone_masked: normalized ? maskRecipient("sms", normalized) : phone ? "***" : null,
      customer: customer ? { id: customer.id, has_account: customer.has_account } : null,
      lines: lines.map((item) => ({
        title: (item.product_title ?? item.title ?? "").trim(),
        variant:
          (item.variant_title ?? "").trim() === "" ? null : (item.variant_title ?? "").trim(),
        quantity: Number(item.quantity),
        thumbnail: item.thumbnail ?? null,
      })),
      line_count: lines.length,
      total: fromMedusaAmount(cart.total, { allowRounding: true }) / 100,
      currency_code: cart.currency_code,
      updated_at: new Date(cart.updated_at).toISOString(),
      reminder: reminder
        ? {
            outcome: reminder.outcome,
            at: new Date(reminder.created_at).toISOString(),
            returned: reminder.returned_at !== null,
          }
        : null,
      consent: { email: emailFacts?.consent ?? null, sms: smsFacts?.consent ?? null },
    }
    return [
      {
        row,
        cart,
        phone,
        suppressed: { email: !!emailFacts?.suppressed, sms: !!smsFacts?.suppressed },
      },
    ]
  })
}

/**
 * Müşteriler > Terk edilen sepetler (2026-11-06): carts left behind in the
 * last 30 days, newest activity first, a page at a time.
 */
export async function listAbandonedCarts(
  container: Container,
  page: { limit: number; offset: number },
  now = new Date()
): Promise<{ carts: AbandonedCartRow[]; count: number }> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const window = [
    new Date(now.getTime() - ABANDONED_AFTER_MS),
    new Date(now.getTime() - ABANDONED_WINDOW_DAYS * DAY_MS),
  ]
  const [counted, paged] = await Promise.all([
    knex.raw<{ rows: { count: number }[] }>(`SELECT count(*)::int AS count ${WHERE}`, window),
    knex.raw<{ rows: { id: string }[] }>(
      `SELECT c.id ${WHERE} ORDER BY c.updated_at DESC, c.id LIMIT ? OFFSET ?`,
      [...window, page.limit, page.offset]
    ),
  ])
  const rows = await hydrate(
    container,
    paged.rows.map((row) => row.id)
  )
  return {
    carts: rows.map(({ row }) => ({ ...row, lines: row.lines.slice(0, ROW_LINES) })),
    count: counted.rows[0]?.count ?? 0,
  }
}

/** One cart left behind, whole, with what staff may do about it (2026-11-06). */
export async function abandonedCartDetail(
  container: Container,
  cartId: string,
  now = new Date()
): Promise<AbandonedCartDetail> {
  const [found] = await hydrate(container, [cartId])
  if (!found || found.cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "abandoned_carts.unknown")
  }
  const { row, cart, phone, suppressed } = found
  const storefront = (await brandOf(container)).storefrontUrl !== null
  const lately =
    cart.email && !row.reminder
      ? await remindedLately(
          container,
          { id: cart.id, email: cart.email, updated_at: cart.updated_at },
          now.getTime()
        )
      : false
  return {
    ...row,
    phone,
    actions: {
      email_block: emailReminderBlock({
        email: cart.email,
        consent: row.consent.email,
        suppressed: suppressed.email,
        // A pending one is being sent: the cart's one reminder is taken
        reminded: row.reminder !== null,
        remindedLately: lately,
        storefront,
      }),
      whatsapp: whatsappNumber(
        phone ? normalizeRecipient("sms", phone) : null,
        row.consent.sms,
        suppressed.sms
      ),
    },
  }
}
