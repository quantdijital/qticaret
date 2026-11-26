import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { refusalOf, restrictionsOf } from "../../lib/promotions/restrictions"
import type { RestrictionRule, Restrictions } from "../../lib/promotions/restrictions"
import { linkIdOfCart } from "../payment-links/cart-guard"
import { placedBefore } from "./first-order"
import type { Buyer } from "./first-order"

type Container = Pick<MedusaContainer, "resolve">

/** The restrictions of the promotions these codes name; codes the shop does not have are not here. */
export async function codeRestrictions(
  container: Container,
  codes: readonly string[]
): Promise<Restrictions[]> {
  if (codes.length === 0) {
    return []
  }
  const promotions = await container
    .resolve(Modules.PROMOTION)
    .listPromotions({ code: [...codes] }, { relations: ["rules", "rules.values"] })
  return promotions
    .map((promotion) => restrictionsOf(promotion.rules as RestrictionRule[] | null | undefined))
    .filter((each) => each.groups !== null || each.firstOrder)
}

/**
 * The groups of the cart's customer when it is an account; null for a
 * guest record (one made by the panel, an import or a guest checkout),
 * which anyone typing its e-mail on a cart would stand in for.
 */
async function groupIdsOf(container: Container, customerId: string): Promise<string[] | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["has_account", "groups.id"],
    filters: { id: customerId },
  })
  const customer = data[0] as
    { has_account?: boolean | null; groups?: ({ id?: string | null } | null)[] | null } | undefined
  if (!customer?.has_account) {
    return null
  }
  return (customer.groups ?? []).flatMap((group) => (group?.id ? [group.id] : []))
}

/**
 * Why the cart's buyer may not use one of these codes (K1/K2), as an error
 * key told to the shopper; null when every one is theirs to use, or not a
 * restricted one. Medusa's rules apply the same restrictions on every
 * refresh: this only says why, before Medusa would quietly not take it.
 */
export async function restrictedCodeRefusal(
  container: Container,
  codes: readonly string[],
  buyer: Buyer,
  options: { strict?: boolean } = {}
): Promise<string | null> {
  const restricted = await codeRestrictions(container, codes)
  if (restricted.length === 0) {
    return null
  }
  const groupIds =
    restricted.some((each) => each.groups !== null) && buyer.customerId
      ? await groupIdsOf(container, buyer.customerId)
      : null
  const before = restricted.some((each) => each.firstOrder)
    ? await placedBefore(container, buyer)
    : null
  for (const restrictions of restricted) {
    const refusal = refusalOf(restrictions, { groupIds, placedBefore: before }, options)
    if (refusal) {
      return refusal
    }
  }
  return null
}

interface CheckoutCart {
  customer_id?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
  promotions?: ({ code?: string | null } | null)[] | null
}

/**
 * At the checkout (K1/K2): every promotion on the cart, automatic ones too,
 * is still the buyer's, read now with the cart's e-mail: a guest's code
 * taken before the e-mail stops here, and a first-order code on a cart
 * naming no buyer at all. Two carts of one buyer completing at the same
 * instant are not held apart (Medusa locks each cart, not each buyer): an
 * accepted risk, as is a buyer with a second e-mail address. A payment
 * link's cart is staff's to price (adr/0051) and is left out.
 */
export async function assertRestrictedCodesHold(
  container: Container,
  cartId: string
): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["customer_id", "email", "metadata", "promotions.code"],
    filters: { id: cartId },
  })
  const cart = data[0] as CheckoutCart | undefined
  if (linkIdOfCart(cart?.metadata) !== null) {
    return
  }
  const codes = (cart?.promotions ?? []).flatMap((each) => (each?.code ? [each.code] : []))
  const refusal = await restrictedCodeRefusal(
    container,
    codes,
    { customerId: cart?.customer_id ?? null, email: cart?.email ?? null },
    { strict: true }
  )
  if (refusal) {
    throw new ValidationError(refusal, { field: "promo_codes" })
  }
}
