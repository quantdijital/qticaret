import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../lib/errors"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { enteredCodes } from "../../lib/promotions"
import { isShortOfMinimum, orderUnits, stalePriceLines } from "../../lib/wholesale"
import type { WholesaleCartLine } from "../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import { linkIdOfCart } from "../payment-links/cart-guard"
import { wholesaleShopper } from "./shopper"
import type { WholesaleShopper } from "./shopper"

type Container = Pick<MedusaContainer, "resolve">

export interface CheckoutCart {
  id: string
  completed_at?: unknown
  currency_code: string
  region_id?: string | null
  customer_id?: string | null
  customer?: { groups?: ({ id: string } | null)[] | null } | null
  metadata?: Record<string, unknown> | null
  total?: MedusaAmount | null
  items?: (WholesaleCartLine | null)[] | null
  promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
}

const CART_FIELDS = [
  "id",
  "completed_at",
  "currency_code",
  "region_id",
  "customer_id",
  "customer.groups.id",
  "metadata",
  "total",
  ...["id", "variant_id", "quantity", "unit_price", "is_custom_price"].map((f) => `items.${f}`),
  "promotions.code",
  "promotions.is_automatic",
]

export async function readCart(
  container: Container,
  cartId: string
): Promise<CheckoutCart | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: CART_FIELDS,
    filters: { id: cartId },
  })
  return data[0] as CheckoutCart | undefined
}

/** The customer is, or once was, a wholesaler: a closed or removed one's carts are judged too. */
async function everWholesale(container: Container, customerId: string): Promise<boolean> {
  const [account] = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleAccounts(
      { customer_id: customerId },
      { select: ["id"], take: 1, withDeleted: true }
    )
  return account !== undefined
}

interface VariantRow {
  id: string
  calculated_price?: { calculated_amount?: MedusaAmount | null } | null
}

/**
 * Each line's unit price as Medusa prices the cart's line now (2.21.2,
 * as `addons/cart.ts` `variantPrice` reads it): the cart's currency and
 * region, its customer and their groups now, the line's quantity (tiered
 * prices). One read per distinct quantity. A line with no price is left out.
 */
async function pricesNow(container: Container, cart: CheckoutCart): Promise<Map<string, Kurus>> {
  const groups = (cart.customer?.groups ?? []).flatMap((group) => (group ? [group.id] : []))
  const byQuantity = new Map<number, { line: string; variant: string }[]>()
  for (const line of cart.items ?? []) {
    if (line?.variant_id && line.is_custom_price !== true) {
      const quantity = Number(line.quantity)
      byQuantity.set(quantity, [
        ...(byQuantity.get(quantity) ?? []),
        { line: line.id, variant: line.variant_id },
      ])
    }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const prices = new Map<string, Kurus>()
  for (const [quantity, lines] of byQuantity) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id", "calculated_price.calculated_amount"],
      filters: { id: [...new Set(lines.map((each) => each.variant))] },
      context: {
        calculated_price: QueryContext({
          currency_code: cart.currency_code,
          ...(cart.region_id ? { region_id: cart.region_id } : {}),
          customer_id: cart.customer_id,
          customer: { id: cart.customer_id, groups: { id: groups } },
          quantity,
        }),
      },
    })
    const amounts = new Map(
      (data as VariantRow[]).flatMap((row) => {
        const amount = row.calculated_price?.calculated_amount
        return amount === null || amount === undefined
          ? []
          : [[row.id, fromMedusaAmount(amount, { allowRounding: true })] as const]
      })
    )
    for (const { line, variant } of lines) {
      const amount = amounts.get(variant)
      if (amount !== undefined) {
        prices.set(line, amount)
      }
    }
  }
  return prices
}

/** What the wholesale rules find on a cart about to be paid. */
export interface WholesaleCartReview {
  shopper: WholesaleShopper
  /** Lines not at the price Medusa gives the customer now. */
  stale: string[]
  /** Codes the shopper entered (§6: none on a wholesaler's cart). */
  codes: string[]
  /** Promotions on the cart, automatic ones too (§6: none on a wholesaler's cart). */
  promotions: number
  units: number
}

/**
 * The wholesale rules' look at a cart (ADR-0068 slice 4). Null for a cart
 * they do not judge: a guest's, a payment link's (adr/0051: staff set its
 * lines, code and prices; the link's own rules check them, §7) and a
 * customer's who never was a wholesaler. A closed or removed wholesaler's
 * cart is judged for its prices only; an active one's for all.
 */
export async function reviewWholesaleCart(
  container: Container,
  cart: CheckoutCart | undefined
): Promise<WholesaleCartReview | null> {
  const customerId = cart?.customer_id
  if (!cart || !customerId || linkIdOfCart(cart.metadata) !== null) {
    return null
  }
  const shopper = await wholesaleShopper(container, customerId)
  if (!shopper.active && !(await everWholesale(container, customerId))) {
    return null
  }
  return {
    shopper,
    stale: stalePriceLines(cart.items ?? [], await pricesNow(container, cart)),
    codes: enteredCodes(cart.promotions),
    promotions: (cart.promotions ?? []).filter(Boolean).length,
    units: orderUnits(cart.items ?? []),
  }
}

/** The minimum units refused (§8), the numbers for the sentence. */
export function assertMinimum(review: WholesaleCartReview): void {
  const { min_quantity: min } = review.shopper
  if (review.shopper.active && isShortOfMinimum(min, review.units)) {
    throw new ValidationError("wholesale.min_quantity", {
      field: "items",
      values: { min: String(min), units: String(review.units) },
    })
  }
}

/** The cart needs Medusa's prices again: a stale line, or a promotion on a wholesaler's cart. */
export const needsPricing = (review: WholesaleCartReview): boolean =>
  review.stale.length > 0 || (review.shopper.active && review.promotions > 0)

/**
 * At the order's completion (the `validate` hook, ADR-0068 §6–§8): a
 * wholesaler's cart with a code, short of its minimum, or a cart not at
 * its customer's prices now is refused. Reads only: the completion holds
 * the cart's lock; the payment start, before it, prices the cart again.
 */
export async function assertWholesaleCartCompletes(
  container: Container,
  cartId: string
): Promise<void> {
  const cart = await readCart(container, cartId)
  // A completion asked again for a cart already ordered answers that order: nothing to judge
  const review = cart?.completed_at ? null : await reviewWholesaleCart(container, cart)
  if (!review) {
    return
  }
  if (review.shopper.active && review.codes.length > 0) {
    throw new ValidationError("promotions.wholesale_no_code", { field: "promo_codes" })
  }
  assertMinimum(review)
  if (needsPricing(review)) {
    throw new ConflictError("wholesale.prices_changed")
  }
}
