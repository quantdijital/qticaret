import { formatLira } from "@qticaret/ui"
import type { CardBookingView, PriceView, ProductCardView, Translate } from "@qticaret/ui"
import type { StoreCardFacts } from "@qticaret/types"
import { FEW_LEFT } from "./booking"
import { durationWords } from "./card-look"
import { percentOff } from "./price"

// The zone a departure is said in when the product's is not one the runtime knows
const DEFAULT_ZONE = "Europe/Istanbul"

/** "12 Ara" in the zone given; the default zone's if it is not known. */
export function shortDeparture(startsAt: string, zone: string = DEFAULT_ZONE): string | null {
  const at = new Date(startsAt)
  if (Number.isNaN(at.getTime())) {
    return null
  }
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat("tr-TR", { timeZone, day: "numeric", month: "short" }).format(at)
  try {
    return format(zone)
  } catch {
    return format(DEFAULT_ZONE)
  }
}

/**
 * A dated product's card from its facts (adr/0076 §10): the server's
 * lowest paying price as a "from" price in place of the card's own (whose
 * lowest variant may be an infant's), and the nearest departure on sale.
 * A price in another currency than lira is not ours to word: the card
 * keeps its own. Its length in words ("5 gün • 4 gece") only while the
 * shop shows it (`look.duration`, adr/0077 Ek "tur kartı") and the
 * backend says one. A date search's card (adr/0077 §4) says its departure
 * is inside the dates asked, and its places left when few ("Son 3 yer",
 * the product page's threshold). Any other product's card is returned as
 * it was.
 */
export function withCardBooking(
  card: ProductCardView,
  booking: StoreCardFacts["booking"],
  t?: Translate
): ProductCardView {
  if (!booking) {
    return card
  }
  const next = booking.next_departure
    ? shortDeparture(booking.next_departure, booking.timezone)
    : null
  const duration = card.look?.duration && t ? durationWords(booking.duration_days, t) : null
  const left = next ? booking.left : null
  const view: CardBookingView = {
    next,
    nextAt: next ? booking.next_departure : null,
    ...(duration ? { duration } : {}),
    ...(typeof left === "number" && left > 0 && left <= FEW_LEFT ? { left } : {}),
    ...(next && booking.in_range ? { inRange: true as const } : {}),
  }
  if (booking.currency_code.toLowerCase() !== "try") {
    return { ...card, booking: view }
  }
  return { ...card, price: bookingPrice(booking.from_price, booking.before), booking: view }
}

/**
 * The server's from price as the card's (promotions taken off), struck
 * through at `before` only when the server sends one (the price-before
 * rule, adr/0076 Ek "kart fiyatı promosyonlu"): an ordinary card's
 * discount and saving beside it. Without one it is drawn as before.
 */
function bookingPrice(fromPrice: number | null, before: number | undefined): PriceView | null {
  if (fromPrice === null) {
    return null
  }
  const plain: PriceView = {
    current: formatLira(fromPrice),
    before: null,
    from: true,
    discount: null,
  }
  return withBefore(plain, fromPrice, before)
}

/**
 * A dated price (`amount`, lira) struck through at `before` when the
 * server sends one: an ordinary card's discount and saving beside it.
 * Without one it is `plain`, drawn as before (adr/0076 Ek "kalkış fiyatı
 * promosyonlu": the card and the upcoming departures alike).
 */
export function withBefore(
  plain: PriceView,
  amount: number,
  before: number | undefined
): PriceView {
  const discount = before === undefined ? null : percentOff(before, amount)
  if (before === undefined || discount === null) {
    return plain
  }
  // In kuruş, so the saving is never a float's hair off
  const saving = (Math.round(before * 100) - Math.round(amount * 100)) / 100
  return { ...plain, before: formatLira(before), discount, saving: formatLira(saving) }
}
