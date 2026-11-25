import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FIRST_ORDER_ATTRIBUTE, FIRST_ORDER_VALUE } from "../../lib/promotions/restrictions"

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
  customer?: { id?: string | null; email?: string | null } | null
  email?: string | null
}

export const buyerOf = (cart: ContextCart | null | undefined): Buyer => ({
  customerId: cart?.customer_id ?? cart?.customer?.id ?? null,
  email: cart?.email ?? cart?.customer?.email ?? null,
})

/**
 * Whether any promotion has a "first order only" rule: the order reads
 * below run on every cart refresh only in a shop that uses one. Medusa's
 * rule filter type names ids only; the module's list takes any column.
 */
async function firstOrderRulesExist(container: Container): Promise<boolean> {
  const rules = await container
    .resolve(Modules.PROMOTION)
    .listPromotionRules({ attribute: FIRST_ORDER_ATTRIBUTE } as unknown as { id?: string[] }, {
      select: ["id"],
      take: 1,
    })
  return rules.length > 0
}

/**
 * The fact a "first order only" rule reads, laid over the cart's context.
 * A buyer not known yet counts as new: the code may sit on a guest's cart,
 * and the cart's refresh when its e-mail comes, and the checkout, decide.
 */
export async function firstOrderContext(
  container: Container,
  cart: ContextCart | null | undefined
): Promise<Record<string, string>> {
  if (!(await firstOrderRulesExist(container))) {
    return {}
  }
  const before = await placedBefore(container, buyerOf(cart))
  return { [FIRST_ORDER_ATTRIBUTE]: before === true ? "false" : FIRST_ORDER_VALUE }
}
