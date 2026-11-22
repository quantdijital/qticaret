import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  BOOKING_KEY,
  bookingUnitsProblem,
  cartShareOf,
  paxOf,
  unitsOf,
} from "../../../lib/booking/cart-lines"
import type { BookingMark } from "../../../lib/booking/cart-lines"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { toMedusaAmount } from "../../../lib/money"
import { clientSlotCap } from "../../../modules/booking/client-share"
import type { HoldClient } from "../../../modules/booking/service"
import { quantityOf, readAddonCart } from "../../addons/cart"
import type { AddonCart } from "../../addons/cart"
import { bookingLinesOf } from "./review"
import {
  assertSlotSells,
  assertVariantsOf,
  bookingEnabled,
  bookingService,
  priceBookingLine,
  readBookingTarget,
} from "./target"
import type { BookingTarget } from "./target"

type Container = Pick<MedusaContainer, "resolve">

export interface CartBookingInput {
  cart_id: string
  slot_id: string
  /** The publishable key's channels: a cart of another channel is not this storefront's. */
  sales_channel_ids: string[]
  /** Price categories and how many of each; nothing else (no price, no date, no person). */
  items: { variant_id: string; quantity: number }[]
  /** The shopper's address as a keyed hash (never the address); null: not known, not capped. */
  client_hash?: string | null
}

/** A line the departure gets, priced on the server; its mark is completed with the hold. */
export interface PlannedLine {
  variant_id: string
  quantity: number
  unit_price: string
  compare_at_unit_price: string | null
  is_tax_inclusive: boolean
  pax: number
}

/** What a booking request changes in the cart. */
export interface CartBookingPlan {
  cart_id: string
  slot_id: string
  starts_at: string
  /** The places the departure's lines take after the change (0: the departure leaves). */
  units: number
  /** What the cart's live hold kept on this slot before (0: nothing, or the hold had ended). */
  units_before: number
  hold_minutes: number
  lines: PlannedLine[]
  /** The cart's lines of this departure now, replaced by `lines`. */
  replaced_line_ids: string[]
  /** The address's live holds capped at this departure's per-cart share (adr/0076 Ek takip M1). */
  client: HoldClient | null
}

/** The storefront's open cart, or 404 (another channel's cart is not this storefront's). */
export async function openCart(container: Container, cartId: string, channels: string[]) {
  const cart = await readAddonCart(container, cartId)
  if (!cart || !channels.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  if (cart.completed_at) {
    throw new ConflictError("cart.completed")
  }
  return cart
}

/** Categories asked twice are added up; the order kept. */
function mergedItems(items: CartBookingInput["items"]): CartBookingInput["items"] {
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.variant_id, (totals.get(item.variant_id) ?? 0) + item.quantity)
  }
  return [...totals.entries()].map(([variant_id, quantity]) => ({ variant_id, quantity }))
}

/** Places the cart's other departures of the same product take (the per-cart cap counts them). */
function otherUnits(cart: AddonCart, target: BookingTarget, slotId: string): number {
  return bookingLinesOf(cart)
    .filter(({ line, mark }) => mark.slot_id !== slotId && line.product_id === target.product.id)
    .reduce(
      (sum, { line }) =>
        sum + quantityOf(line) * paxOf(target.bookable.pax_by_variant, line.variant_id ?? ""),
      0
    )
}

/**
 * Checks a booking request and prices it; writes nothing (adr/0076 §5):
 * the storefront's open cart, a departure of a published dated product of
 * its channel, open and before its sales close, variants of that product,
 * at least one place, at most 100 of a category and two infants per
 * place, no more than the product's per-cart cap nor a fifth of the
 * departure (adr/0076 Ek). Each line is priced from the cart's own pricing context and the departure's
 * difference, never from the request.
 */
export async function planCartBooking(
  container: Container,
  input: CartBookingInput
): Promise<CartBookingPlan> {
  if (!(await bookingEnabled(container))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  const cart = await openCart(container, input.cart_id, input.sales_channel_ids)
  const target = await readBookingTarget(container, input.slot_id, cart.sales_channel_id)
  assertSlotSells(target)
  // adr/0076 Ek 2026-11-23: a product sold by call-me request only has no cart
  if (target.bookable.sale_mode === "request") {
    throw new ValidationError("booking.online_not_offered", { field: "slot_id" })
  }
  const items = mergedItems(input.items)
  assertVariantsOf(
    target,
    items.map((item) => item.variant_id)
  )
  const problem = bookingUnitsProblem(items, target.bookable.pax_by_variant)
  if (problem) {
    throw new ValidationError(problem, { field: "items" })
  }
  const units = unitsOf(items, target.bookable.pax_by_variant)
  const cap = target.bookable.max_units_per_cart
  // The product's cap over all its departures; a fifth of this one's places (adr/0076 Ek)
  const share = cartShareOf(target.slot.capacity, cap)
  if (units + otherUnits(cart, target, input.slot_id) > cap || units > share) {
    throw new ValidationError("booking.max_units", {
      field: "items",
      values: { max: String(Math.min(cap, share)) },
    })
  }
  const lines: PlannedLine[] = []
  for (const item of items) {
    const price = await priceBookingLine(container, cart, target, item.variant_id, item.quantity)
    lines.push({
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: toMedusaAmount(price.unit_price),
      compare_at_unit_price:
        price.compare_at_unit_price === null ? null : toMedusaAmount(price.compare_at_unit_price),
      is_tax_inclusive: price.is_tax_inclusive,
      pax: paxOf(target.bookable.pax_by_variant, item.variant_id),
    })
  }
  return {
    cart_id: cart.id,
    slot_id: input.slot_id,
    starts_at: target.slot.starts_at.toISOString(),
    units,
    units_before: await unitsHeld(container, cart.id, input.slot_id),
    hold_minutes: target.bookable.hold_minutes,
    lines,
    replaced_line_ids: lineIdsOfSlot(cart, input.slot_id),
    client: input.client_hash
      ? { hash: input.client_hash, maxPerSlot: clientSlotCap(target.slot.capacity, share) }
      : null,
  }
}

/** What the cart's live hold keeps on the slot (0 with no hold or an ended one). */
export async function unitsHeld(container: Container, cartId: string, slotId: string) {
  const hold = await bookingService(container).cartHold(cartId)
  return hold?.live ? (hold.slots.find((slot) => slot.slotId === slotId)?.units ?? 0) : 0
}

export const lineIdsOfSlot = (cart: AddonCart, slotId: string): string[] =>
  bookingLinesOf(cart)
    .filter(({ mark }) => mark.slot_id === slotId)
    .map(({ line }) => line.id)

/** The cart lines Medusa adds for the plan, each marked with the hold it was taken under. */
export function cartItemsOf(plan: CartBookingPlan, holdId: string) {
  return plan.lines.map((line) => {
    const mark: BookingMark = {
      hold_id: holdId,
      slot_id: plan.slot_id,
      starts_at: plan.starts_at,
      pax: line.pax,
    }
    return {
      variant_id: line.variant_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      // Said outright, not left to Medusa's fallback for a custom price
      is_tax_inclusive: line.is_tax_inclusive,
      ...(line.compare_at_unit_price === null
        ? {}
        : { compare_at_unit_price: line.compare_at_unit_price }),
      metadata: { [BOOKING_KEY]: mark },
    }
  })
}
