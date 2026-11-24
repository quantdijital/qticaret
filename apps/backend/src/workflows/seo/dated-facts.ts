import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { salesClosed } from "../../lib/booking/cart-lines"
import { programItinerary, programOf } from "../../lib/booking/program"
import type { Kurus } from "../../lib/money"
import { DATED_DEPARTURES } from "../../lib/seo/jsonld"
import type { DatedFacts, DepartureFacts } from "../../lib/seo/jsonld"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import type { CatalogSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { SlotAvailability } from "../../modules/booking/service"
import { bookingCardFactOf, cardUnits } from "../booking/card-facts"
import type { DatedCardProduct } from "../booking/card-facts"
import { baseAmounts, basePriceRows, placeDisplays } from "../booking/card-price"
import type { CardShown } from "../booking/card-price"
import { bookingService } from "../booking/cart/target"

type Container = Pick<MedusaContainer, "resolve">

/** The departures its structured data names: still on sale, the first `DATED_DEPARTURES`. */
function namedSlots(
  product: DatedCardProduct,
  slots: readonly SlotAvailability[],
  now: Date
): SlotAvailability[] {
  const cutoff = product.bookable?.cutoff_hours ?? 0
  return slots
    .filter((slot) => slot.status === "open" && !salesClosed(slot.starts_at, cutoff, now))
    .slice(0, DATED_DEPARTURES)
}

/**
 * A departure as its structured data says it: its times, the lowest price a
 * place sells at then (the card's rule, for this departure alone: a guest's
 * price in lira, each category's difference added, the automatic promotions
 * taken off as `shown` says by `placeKey`, adr/0076 Ek "kalkış fiyatı
 * promosyonlu"; never a price struck through) and whether one is free.
 */
export function departureFactsOf(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  slots: readonly SlotAvailability[],
  now: Date,
  shown: ReadonlyMap<string, CardShown> = new Map()
): DepartureFacts[] {
  return namedSlots(product, slots, now).map((slot) => ({
    startsAt: slot.starts_at.toISOString(),
    endsAt: slot.ends_at?.toISOString() ?? null,
    price: bookingCardFactOf(product, bases, [slot], "try", now, false, shown)?.from_price ?? null,
    available: slot.available > 0,
  }))
}

/**
 * A dated product's structured data facts (adr/0076 §10): the type the
 * shop's catalog settings name and its next departures still on sale.
 * Null unless the shop sells dated products (`catalog.booking`) and this
 * one is sold by departure with its settings made: its page then says
 * "soon" and its `Product` is all it has. A product whose departures have
 * all passed keeps its trip, with none named.
 */
export async function datedFactsOf(
  container: Container,
  productId: string,
  bookingMode: string | null | undefined
): Promise<DatedFacts | null> {
  if (bookingMode !== "departure") {
    return null
  }
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(CATALOG_BOOKING))) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      "variants.variant_rank",
      "product_extension.booking_mode",
      "bookable.id",
      "bookable.cutoff_hours",
      "bookable.pax_by_variant",
      "bookable.timezone",
      "bookable.program",
    ],
    filters: { id: productId },
  })
  const product = (data as DatedCardProduct[])[0]
  const bookable = product?.bookable
  if (!product || !bookable) {
    return null
  }
  const now = new Date()
  const variantIds = (product.variants ?? []).flatMap((variant) => (variant ? [variant.id] : []))
  // Departures with a place free only; a full one is no offer to name
  const [prices, slots, catalog] = await Promise.all([
    basePriceRows(container, variantIds, { currency_code: "try" }),
    bookingService(container).openSlots([bookable.id], { from: now, limit: DATED_DEPARTURES * 2 }),
    settings.getSection("catalog") as Promise<unknown> as Promise<CatalogSettings>,
  ])
  // adr/0078: a trip names its program's steps; an event has no itinerary
  const program =
    catalog.dated_schema_type === "TouristTrip"
      ? programOf((bookable as { program?: unknown }).program)
      : null
  const bases = baseAmounts(prices)
  // The named departures' places in one reading of the record and the promotions
  const units = namedSlots(product, slots, now).flatMap((slot) =>
    cardUnits(product, bases, [slot], "try", now)
  )
  const shown = await placeDisplays(container, units, prices, "try", now)
  return {
    type: catalog.dated_schema_type,
    departures: departureFactsOf(product, bases, slots, now, shown),
    ...(program ? { itinerary: programItinerary(program) } : {}),
  }
}
