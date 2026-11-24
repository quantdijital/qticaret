import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  STORE_SLOTS_LIMIT,
  adjustmentOf,
  adjustmentProblem,
  bookingUnitPrice,
  paxOf,
  salesClosed,
} from "../../lib/booking/cart-lines"
import type { SlotAvailability } from "../../modules/booking/service"
import type { AddonCart } from "../addons/cart"
import type { PayingUnit } from "./card-facts"
import { baseAmounts, basePriceRows, lira, placeDisplays, shownOf, struck } from "./card-price"
import { bookingService } from "./cart/target"
import type { BookableRow } from "./product"

type Container = Pick<MedusaContainer, "resolve">

interface ProductRow {
  id: string
  status?: string | null
  variants?: ({ id: string; title?: string | null } | null)[] | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
  bookable?: BookableRow | null
}

interface PaxEntry {
  pax?: number
  min_age?: number
  max_age?: number
}

/** The currency (and region) the page's prices are read in: the region's, else lira. */
async function pricingCart(container: Container, regionId: string | undefined) {
  if (!regionId) {
    return { id: "", currency_code: "try" } satisfies AddonCart
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { id: regionId },
  })
  const region = data[0] as { id: string; currency_code: string } | undefined
  if (!region) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.region_unknown")
  }
  return { id: "", currency_code: region.currency_code, region_id: region.id } satisfies AddonCart
}

/**
 * GET /store/products/:id/booking (adr/0076 §10, read by D5): a published
 * dated product's price categories (places a unit takes, ages) and its
 * departures from now on, each with the places free now (live holds only)
 * and every category's price for that departure worked out on the server
 * (a guest's price, the automatic promotions taken off as on its card,
 * adr/0076 Ek "kalkış fiyatı promosyonlu", and the price struck through
 * only by the card's rule; the cart prices the line again with its own
 * context).
 * A departure past its sales' close reads `closed`; a cancelled one is not
 * listed. No person's data. Another product reads as unknown.
 */
export async function storeProductBooking(
  container: Container,
  productId: string,
  salesChannelIds: readonly string[],
  regionId?: string
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "status",
      "variants.id",
      "variants.title",
      "sales_channels.id",
      "product_extension.booking_mode",
      "bookable.*",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  const listed = (product?.sales_channels ?? []).some((channel) =>
    salesChannelIds.includes(channel?.id ?? "")
  )
  const bookable = product?.bookable
  if (
    !product ||
    !bookable ||
    product.status !== "published" ||
    product.product_extension?.booking_mode !== "departure" ||
    !listed
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const cart = await pricingCart(container, regionId)
  const variants = (product.variants ?? []).flatMap((variant) => (variant ? [variant] : []))
  const now = new Date()
  const [prices, all] = await Promise.all([
    basePriceRows(
      container,
      variants.map((variant) => variant.id),
      {
        currency_code: cart.currency_code,
        ...(cart.region_id ? { region_id: cart.region_id } : {}),
      }
    ),
    bookingService(container).bookableSlots(bookable.id, { from: now, limit: STORE_SLOTS_LIMIT }),
  ])
  const bases = baseAmounts(prices)
  const slots = all.filter((slot) => slot.status !== "cancelled")
  // A departure's places: every category priced (base plus its difference), as the cart's lines
  const placesOf = (slot: SlotAvailability): PayingUnit[] =>
    variants.flatMap((variant) => {
      const base = bases.get(variant.id)
      const adjustment = adjustmentOf(slot.price_adjustments, variant.id)
      if (
        base === null ||
        base === undefined ||
        adjustmentProblem(cart.currency_code, adjustment)
      ) {
        return []
      }
      return [{ variant_id: variant.id, adjustment, amount: bookingUnitPrice(base, adjustment) }]
    })
  // Every departure's places in one reading of the record and the promotions
  const shown = await placeDisplays(
    container,
    slots.flatMap(placesOf),
    prices,
    cart.currency_code,
    now
  )
  const pax = (bookable.pax_by_variant ?? {}) as Record<string, PaxEntry | undefined>
  return {
    cutoff_hours: bookable.cutoff_hours,
    hold_minutes: bookable.hold_minutes,
    max_units_per_cart: bookable.max_units_per_cart,
    // adr/0076 Ek 2026-11-23: the page offers the cart, a call-me request, or both
    sale_mode: bookable.sale_mode,
    timezone: bookable.timezone,
    currency_code: cart.currency_code,
    categories: variants.map((variant) => ({
      variant_id: variant.id,
      title: variant.title ?? null,
      pax: paxOf(bookable.pax_by_variant, variant.id),
      min_age: pax[variant.id]?.min_age ?? null,
      max_age: pax[variant.id]?.max_age ?? null,
    })),
    slots: slots.map((slot) => {
      const selling =
        slot.status === "open" && !salesClosed(slot.starts_at, bookable.cutoff_hours, now)
      return {
        id: slot.id,
        starts_at: slot.starts_at.toISOString(),
        ends_at: slot.ends_at?.toISOString() ?? null,
        status: selling ? ("open" as const) : ("closed" as const),
        available: selling ? slot.available : 0,
        // adr/0076 Ek "kalkış fiyatı promosyonlu": the card's price, the automatic promotions off
        prices: placesOf(slot).map((unit) => {
          const price = shownOf(shown, unit)
          return { variant_id: unit.variant_id, amount: lira(price.current), ...struck(price) }
        }),
      }
    }),
  }
}
