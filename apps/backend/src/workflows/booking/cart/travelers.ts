import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  checkTravelers,
  levelOf,
  maskDocument,
  purgeAfterOf,
  travelersComplete,
} from "../../../lib/booking/travelers"
import type { TravelerInput, TravelerNeed } from "../../../lib/booking/travelers"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { readAddonCart } from "../../addons/cart"
import type { AddonCart } from "../../addons/cart"
import { slotLinesOf } from "./review"
import type { SlotLines } from "./review"
import { bookingService } from "./target"

type Container = Pick<MedusaContainer, "resolve">

/** What each departure in the cart asks: its places' worth of travelers at its product's level. */
export const travelerNeedsOf = (slots: readonly SlotLines[]): TravelerNeed[] =>
  slots.map((slot) => ({
    slot_id: slot.slot_id,
    level: levelOf(slot.target.bookable.traveler_fields),
    count: slot.units,
  }))

const asking = (needs: readonly TravelerNeed[]) =>
  needs.filter((need) => need.level !== "none" && need.count > 0)

// The columns a reading shows: never the sealed number nor its hash
const SHOWN = [
  "id",
  "slot_id",
  "position",
  "first_name",
  "last_name",
  "birth_date",
  "nationality",
  "document_last4",
]

/** The cart's travelers not yet booked, by departure and order; the number masked. */
async function unbookedTravelers(container: Container, cartId: string) {
  const rows = await bookingService(container).listBookingTravelers(
    { cart_id: cartId, booking_id: null },
    { select: SHOWN, order: { slot_id: "ASC", position: "ASC" }, take: 1000 }
  )
  return rows.map((row) => ({
    slot_id: row.slot_id,
    position: row.position,
    first_name: row.first_name,
    last_name: row.last_name,
    birth_date: row.birth_date ?? null,
    nationality: row.nationality ?? null,
    document_last4: row.document_last4 ?? null,
  }))
}

/** This storefront's open cart, or 404 (another channel's reads as missing) / 409 (completed). */
async function openCart(
  container: Container,
  cartId: string,
  salesChannelIds: readonly string[]
): Promise<AddonCart> {
  const cart = await readAddonCart(container, cartId)
  if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  if (cart.completed_at) {
    throw new ConflictError("cart.completed")
  }
  return cart
}

/**
 * The cart's travelers as the storefront reads them (adr/0076 §7): what
 * each departure asks (`level`, `count` from Σ quantity × pax), the ones
 * entered (a number only as its last four) and whether they answer it.
 */
export async function cartTravelersView(
  container: Container,
  cartId: string,
  salesChannelIds: readonly string[]
) {
  const cart = await openCart(container, cartId, salesChannelIds)
  const slots = (await slotLinesOf(container, cart, { sells: false })) ?? []
  const needs = asking(travelerNeedsOf(slots))
  const stored = needs.length > 0 ? await unbookedTravelers(container, cartId) : []
  return {
    needs: needs.map((need) => {
      const startsAt = slots.find((slot) => slot.slot_id === need.slot_id)?.target.slot.starts_at
      return { ...need, starts_at: startsAt ? new Date(startsAt).toISOString() : null }
    }),
    travelers: stored.map(({ document_last4: last4, ...traveler }) => ({
      ...traveler,
      document_masked: maskDocument(last4),
    })),
    complete: travelersComplete(needs, stored),
  }
}

/**
 * POST /store/carts/:id/travelers (adr/0076 §7): the cart's travelers
 * replaced by these, under the cart's lock (as a payment's start and the
 * completion take it). Not a workflow on purpose: a workflow keeps its
 * steps' input, and a plain ID number goes no further than the module,
 * which seals it (as the billing profile's tax id, adr/0009).
 */
export async function setCartTravelers(
  container: Container,
  cartId: string,
  salesChannelIds: readonly string[],
  inputs: readonly TravelerInput[]
): Promise<void> {
  await container.resolve(Modules.LOCKING).execute(
    cartId,
    async () => {
      const cart = await openCart(container, cartId, salesChannelIds)
      const slots = (await slotLinesOf(container, cart, { sells: false })) ?? []
      const travelers = checkTravelers(travelerNeedsOf(slots), inputs)
      const purgeAfter = Object.fromEntries(
        slots.map((slot) => [
          slot.slot_id,
          purgeAfterOf(new Date(slot.target.slot.starts_at), endsOf(slot)),
        ])
      )
      await bookingService(container).setCartTravelers(cartId, travelers, purgeAfter)
    },
    { timeout: 5 }
  )
}

const endsOf = (slot: SlotLines): Date | null =>
  slot.target.slot.ends_at ? new Date(slot.target.slot.ends_at) : null

/**
 * At a payment's start and the order's completion: every departure that
 * asks for travelers has them, as many as its places now, each with the
 * fields its product asks now; 400 `booking.travelers_missing` otherwise.
 */
export async function assertTravelersComplete(
  container: Container,
  cartId: string,
  slots: readonly SlotLines[]
): Promise<void> {
  const needs = asking(travelerNeedsOf(slots))
  if (needs.length === 0) {
    return
  }
  if (!travelersComplete(needs, await unbookedTravelers(container, cartId))) {
    throw new ValidationError("booking.travelers_missing", { field: "travelers" })
  }
}
