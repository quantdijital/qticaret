import type { MedusaContainer } from "@medusajs/framework/types"
import { bookingMarkOf, paxOf } from "../../../lib/booking/cart-lines"
import type { BookingMark } from "../../../lib/booking/cart-lines"
import { isStalePrice } from "../../../lib/catalog/addons"
import { ValidationError } from "../../../lib/errors"
import type { CartHold, SlotUnits } from "../../../modules/booking/service"
import { linesOf, quantityOf } from "../../addons/cart"
import type { AddonCart, AddonCartLine } from "../../addons/cart"
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

/** A cart line with its booking record. */
export interface BookingLine {
  line: AddonCartLine
  mark: BookingMark
}

/** One departure's lines in the cart and the places they take now. */
export interface SlotLines {
  slot_id: string
  lines: BookingLine[]
  /** Σ quantity × pax, with the product's place counts now. */
  units: number
  target: BookingTarget
}

/** The cart's dated lines (a line with a booking record). */
export function bookingLinesOf(cart: AddonCart): BookingLine[] {
  return linesOf(cart).flatMap((line) => {
    const mark = bookingMarkOf(line.metadata)
    return mark ? [{ line, mark }] : []
  })
}

/**
 * The cart's dated lines by departure, each departure read as the cart's
 * storefront sees it now: a slot gone, unpublished or out of the channel
 * reads as unknown; one closed or past its sales, as closed; a variant no
 * longer the product's, as unknown; selling, a product now sold by request
 * only stops the payment and the completion. Null when the cart has none; with the
 * shop's bookings off, a dated line stops the cart.
 */
export async function slotLinesOf(
  container: Container,
  cart: AddonCart,
  options: { sells: boolean }
): Promise<SlotLines[] | null> {
  const lines = bookingLinesOf(cart)
  if (lines.length === 0) {
    return null
  }
  if (!(await bookingEnabled(container))) {
    throw new ValidationError("catalog.booking_disabled", { field: "items" })
  }
  const bySlot = new Map<string, BookingLine[]>()
  for (const entry of lines) {
    bySlot.set(entry.mark.slot_id, [...(bySlot.get(entry.mark.slot_id) ?? []), entry])
  }
  const result: SlotLines[] = []
  for (const [slotId, slotLines] of [...bySlot.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const target = await readBookingTarget(container, slotId, cart.sales_channel_id)
    if (options.sells) {
      assertSlotSells(target)
      // Turned to call-me request only after the line went in (adr/0076 Ek 2026-11-23)
      if (target.bookable.sale_mode === "request") {
        throw new ValidationError("booking.online_not_offered", { field: "items" })
      }
    }
    assertVariantsOf(
      target,
      slotLines.map(({ line }) => line.variant_id ?? "")
    )
    const units = slotLines.reduce(
      (sum, { line }) =>
        sum + quantityOf(line) * paxOf(target.bookable.pax_by_variant, line.variant_id ?? ""),
      0
    )
    result.push({ slot_id: slotId, lines: slotLines, units, target })
  }
  return result
}

/** Places per slot the lines take, in id order (the hold's own order). */
export const unitsOfSlots = (slots: readonly SlotLines[]): SlotUnits[] =>
  slots
    .filter((slot) => slot.units > 0)
    .map((slot) => ({ slotId: slot.slot_id, units: slot.units }))

/** Whether the hold keeps exactly the places the lines take, slot by slot. */
export function holdMatches(hold: CartHold, slots: readonly SlotLines[]): boolean {
  const wanted = unitsOfSlots(slots)
  return (
    hold.slots.length === wanted.length &&
    wanted.every((slot, index) => {
      const held = hold.slots[index]
      return held?.slotId === slot.slotId && held.units === slot.units
    })
  )
}

/** Lines whose unit price is not what the departure costs in the cart now. */
export async function staleBookingLines(
  container: Container,
  cart: AddonCart,
  slots: readonly SlotLines[]
): Promise<AddonCartLine[]> {
  const stale: AddonCartLine[] = []
  for (const slot of slots) {
    for (const { line } of slot.lines) {
      const price = await priceBookingLine(
        container,
        cart,
        slot.target,
        line.variant_id ?? "",
        quantityOf(line)
      )
      if (isStalePrice(line, price.unit_price, price.is_tax_inclusive)) {
        stale.push(line)
      }
    }
  }
  return stale
}

/**
 * Gives back places the cart's live hold keeps beyond its lines (a line
 * removed through the core route, a slot's lines all gone); never takes
 * more. Run under the cart's lock. The hold as it stands after.
 */
export async function trimHoldToLines(
  container: Container,
  cartId: string,
  slots: readonly SlotLines[]
): Promise<CartHold | null> {
  const service = bookingService(container)
  const hold = await service.cartHold(cartId)
  if (!hold?.live) {
    return hold
  }
  const wanted = new Map(unitsOfSlots(slots).map((slot) => [slot.slotId, slot.units]))
  const lower = hold.slots.flatMap((slot) => {
    const units = wanted.get(slot.slotId) ?? 0
    return units < slot.units ? [{ slotId: slot.slotId, units }] : []
  })
  if (lower.length === 0) {
    return hold
  }
  await service.holdUnits(cartId, lower, minutesLeft(hold))
  return service.cartHold(cartId)
}

/** The hold's time left in whole minutes (1-120): a change made to it keeps its end. */
export const minutesLeft = (hold: CartHold, now: number = Date.now()): number =>
  Math.min(120, Math.max(1, Math.ceil((hold.expires_at.getTime() - now) / 60_000)))
