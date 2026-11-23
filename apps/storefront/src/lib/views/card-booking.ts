import { formatLira } from "@qticaret/ui"
import type { CardBookingView, PriceView, ProductCardView, Translate } from "@qticaret/ui"
import type { StoreCardFacts } from "@qticaret/types"
import { FEW_LEFT } from "./booking"
import { durationWords } from "./card-look"

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
  const price: PriceView | null =
    booking.from_price === null
      ? null
      : { current: formatLira(booking.from_price), before: null, from: true, discount: null }
  return { ...card, price, booking: view }
}
