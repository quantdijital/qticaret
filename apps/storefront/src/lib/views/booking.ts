import { formatLira } from "@qticaret/ui"
import type {
  BookingCategoryView,
  BookingHoldView,
  BookingView,
  CartLineBookingView,
  Translate,
} from "@qticaret/ui"
import type { StoreBookingCategory, StoreCartBooking, StoreProductBooking } from "../booking/store"

/**
 * Dated products' views (adr/0076 §10): a product page's departures and
 * price categories, a dated cart line and the cart's hold. Prices are the
 * server's, put in words here; nothing is priced on the storefront.
 */

/** "Son N yer" from this many places free (owner's wording, adr/0076 §10). */
export const FEW_LEFT = 5

/** The zone a departure is told in when the cart does not say (the backend's default too). */
export const DEFAULT_ZONE = "Europe/Istanbul"

/** A line's record of its departure (`metadata.qt_booking`, written only by the booking route). */
export interface BookingMark {
  slot_id: string
  starts_at: string
  hold_id: string
}

export function bookingMarkOf(metadata: unknown): BookingMark | null {
  const mark =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)["qt_booking"]
      : undefined
  if (typeof mark !== "object" || mark === null) {
    return null
  }
  const { slot_id: slotId, starts_at: startsAt, hold_id: holdId } = mark as Record<string, unknown>
  return typeof slotId === "string" && typeof startsAt === "string" && typeof holdId === "string"
    ? { slot_id: slotId, starts_at: startsAt, hold_id: holdId }
    : null
}

/** "Cumartesi, 12 Aralık 2026 · 09:00" in the zone given; the zone's own if it is not known. */
export function departureLabel(startsAt: string, zone: string = DEFAULT_ZONE): string {
  const at = new Date(startsAt)
  if (Number.isNaN(at.getTime())) {
    return startsAt
  }
  const format = (timeZone: string) => {
    const day = new Intl.DateTimeFormat("tr-TR", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(at)
    const time = new Intl.DateTimeFormat("tr-TR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(at)
    return `${day} · ${time}`
  }
  try {
    return format(zone)
  } catch {
    return format(DEFAULT_ZONE)
  }
}

/** A category's ages in words; null when the shop set none. */
export function agesOf(category: StoreBookingCategory, t: Translate): string | null {
  const { min_age: min, max_age: max } = category
  if (min !== null && max !== null) {
    return t("booking.ages", { min, max })
  }
  if (min !== null) {
    return t("booking.ages_from", { min })
  }
  return max !== null ? t("booking.ages_to", { max }) : null
}

/**
 * A dated product while the shop has dated sales off: no departures, so
 * "new dates soon" in place of "add to cart" (the plain add is refused).
 */
export const EMPTY_BOOKING: BookingView = {
  categories: [],
  departures: [],
  fewLeft: FEW_LEFT,
  maxUnits: 0,
}

/**
 * The product page's booking form from the backend's answer: the
 * categories with their ages, the departures soonest first, each told in
 * the product's zone with its places and each category's price.
 */
export function bookingViewOf(
  booking: StoreProductBooking,
  t: Translate,
  privacyPath: string | null = null
): BookingView {
  const categories: BookingCategoryView[] = booking.categories.map((category) => ({
    variantId: category.variant_id,
    title: category.title ?? "",
    pax: category.pax,
    ages: agesOf(category, t),
  }))
  return {
    categories,
    departures: [...booking.slots]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.starts_at,
        label: departureLabel(slot.starts_at, booking.timezone),
        available: slot.status === "open" ? Math.max(0, slot.available) : 0,
        status: slot.status,
        prices: slot.prices.map((price) => ({
          variantId: price.variant_id,
          price: formatLira(price.amount),
          kurus: Math.round(price.amount * 100),
        })),
      })),
    fewLeft: FEW_LEFT,
    maxUnits: booking.max_units_per_cart,
    // A call-me request (adr/0076 Ek 2026-11-23); an online-only product's view stays as it was
    ...(booking.sale_mode === "request" || booking.sale_mode === "both"
      ? { saleMode: booking.sale_mode, privacyPath }
      : {}),
  }
}

/**
 * A dated line's departure and whether its places are still held: by the
 * cart's read when it came (`held`), else by its mark alone with the hold
 * taken as live (the payment checks it anyway). Null for any other line.
 */
export function lineBookingOf(
  lineId: string,
  metadata: unknown,
  booking: StoreCartBooking | null
): CartLineBookingView | null {
  const mark = bookingMarkOf(metadata)
  if (!mark) {
    return null
  }
  const read = booking?.lines.find((line) => line.id === lineId)
  return {
    departure: departureLabel(mark.starts_at),
    expired: booking !== null && !(read?.held ?? false),
  }
}

/** The cart's dated lines told again with the cart's read: each expired once its places are not held. */
export function withBookingRead<Line extends { id: string; booking?: CartLineBookingView | null }>(
  lines: Line[],
  items: readonly { id: string; metadata?: Record<string, unknown> | null }[],
  booking: StoreCartBooking | null
): Line[] {
  if (!booking) {
    return lines
  }
  const byId = new Map(items.map((item) => [item.id, item.metadata]))
  return lines.map((line) => {
    const told = line.booking ? lineBookingOf(line.id, byId.get(line.id), booking) : null
    return told ? { ...line, booking: told } : line
  })
}

/** The cart's hold for its countdown; null without dated lines or without the cart's read. */
export function holdViewOf(
  items: readonly { metadata?: Record<string, unknown> | null }[],
  booking: StoreCartBooking | null
): BookingHoldView | null {
  if (!booking || !items.some((item) => bookingMarkOf(item.metadata) !== null)) {
    return null
  }
  return { expiresAt: booking.hold?.expires_at ?? null }
}

/** Whether the cart holds a dated line (its hold is worth reading). */
export const hasBookingLines = (
  items: readonly { metadata?: Record<string, unknown> | null }[] | undefined
): boolean => (items ?? []).some((item) => bookingMarkOf(item.metadata) !== null)
