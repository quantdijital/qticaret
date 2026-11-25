import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  FIRST_ORDER_ATTRIBUTE,
  FIRST_ORDER_VALUE,
  restrictionsOf,
} from "../../lib/promotions/restrictions"
import { linkIdOfCart } from "../payment-links/cart-guard"

type Container = Pick<MedusaContainer, "resolve">

// An order placed: not a draft, nor one canceled (it was never bought)
const NOT_PLACED = ["draft", "canceled"]

/** The buyer of a cart: its customer (a guest's too, Medusa ties those by e-mail) and its e-mail. */
export interface Buyer {
  customerId: string | null
  email: string | null
}

// `ILIKE` reads `%` and `_` as wildcards: an address with `_` must match only itself
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

async function anyOrder(container: Container, filters: Record<string, unknown>) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    filters: { ...filters, status: { $nin: NOT_PLACED }, is_draft_order: false },
    pagination: { take: 1 },
  })
  return data.length > 0
}

/**
 * Whether the buyer placed an order before (K2): by their customer, or by
 * their e-mail in any case (a registered customer's guest orders, a
 * guest's orders as another guest customer). Null when the cart names
 * neither: a guest's cart before its e-mail.
 */
export async function placedBefore(container: Container, buyer: Buyer): Promise<boolean | null> {
  const email = buyer.email?.trim()
  if (!buyer.customerId && !email) {
    return null
  }
  if (buyer.customerId && (await anyOrder(container, { customer_id: buyer.customerId }))) {
    return true
  }
  return email ? anyOrder(container, { email: { $ilike: literal(email) } }) : false
}

interface ContextCart {
  customer_id?: string | null
  customer?: {
    id?: string | null
    email?: string | null
    has_account?: boolean | null
    groups?: unknown[] | null
  } | null
  email?: string | null
  metadata?: Record<string, unknown> | null
  promotions?: ({ code?: string | null } | null)[] | null
}

export const buyerOf = (cart: ContextCart | null | undefined): Buyer => ({
  customerId: cart?.customer_id ?? cart?.customer?.id ?? null,
  email: cart?.email ?? cart?.customer?.email ?? null,
})

/**
 * Whether the cart may meet a "first order only" rule: a code it holds or
 * is being given has one, or an active automatic promotion does. Only then
 * are the buyer's orders read (review L3): not on every refresh of every cart.
 */
async function meetsFirstOrderRule(
  container: Container,
  cart: ContextCart | null | undefined,
  sentCodes: readonly string[]
): Promise<boolean> {
  const promotions = container.resolve(Modules.PROMOTION)
  const codes = [
    ...new Set([
      ...sentCodes,
      ...(cart?.promotions ?? []).flatMap((each) => (each?.code ? [each.code] : [])),
    ]),
  ]
  const [coded, automatic] = await Promise.all([
    codes.length > 0
      ? promotions.listPromotions({ code: codes }, { relations: ["rules", "rules.values"] })
      : Promise.resolve([]),
    promotions.listPromotions(
      { is_automatic: true, status: ["active"] },
      { relations: ["rules", "rules.values"] }
    ),
  ])
  return [...coded, ...automatic].some(
    (promotion) =>
      restrictionsOf(promotion.rules).firstOrder
  )
}

/**
 * The facts the restriction rules read, laid over the cart's context (K1/K2):
 * - `first_order`: a buyer not known yet counts as new (the code may sit on a
 *   guest's cart; the refresh when its e-mail comes, and the checkout, decide);
 *   a payment link's cart is staff's to price (adr/0051) and counts as new.
 * - the customer's groups only for an account: a guest record (made by the
 *   panel, an import or a guest checkout) is stood in for by anyone typing its
 *   e-mail, so Medusa's `customer.groups.id` rule reads none for it (review M1).
 */
export async function restrictionContext(
  container: Container,
  cart: ContextCart | null | undefined,
  sentCodes: readonly string[] = []
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {}
  if (cart?.customer && !cart.customer.has_account && (cart.customer.groups?.length ?? 0) > 0) {
    context["customer"] = { ...cart.customer, groups: [] }
  }
  if (!(await meetsFirstOrderRule(container, cart, sentCodes))) {
    return context
  }
  const before =
    linkIdOfCart(cart?.metadata) === null ? await placedBefore(container, buyerOf(cart)) : false
  context[FIRST_ORDER_ATTRIBUTE] = before === true ? "false" : FIRST_ORDER_VALUE
  return context
}
