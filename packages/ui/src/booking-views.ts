/**
 * Dated products' view models (adr/0076 §10): a product page's departures
 * and price categories, a dated cart line and the cart's hold. Prices
 * come in words; the kuruş beside them only feed the page's running
 * total, which shows and decides nothing (the server prices the lines).
 * A theme without these draws the page as before (adr/0066 K6).
 */

/** One price category (a variant): "Yetişkin", "Çocuk (2–11 yaş)", "Bebek". */
export interface BookingCategoryView {
  variantId: string
  title: string
  /** Places one unit takes; 0: it takes none (an infant on a lap). */
  pax: number
  /** The ages the shop set, in words ("2–11 yaş"); null: none set. */
  ages: string | null
}

/** One category's price on one departure. */
export interface BookingPriceView {
  variantId: string
  /** "1.250,00 TL". */
  price: string
  kurus: number
}

/** One departure as the page offers it. */
export interface BookingDepartureView {
  id: string
  /** Machine form, for `<time>`. */
  startsAt: string
  /** In the product's own time zone: "Cumartesi, 12 Aralık 2026 · 09:00". */
  label: string
  /** Places free now; 0 when closed. */
  available: number
  /** `closed`: sales past their close or the shop closed it; `open` with 0 places is full. */
  status: "open" | "closed"
  /** Each category's price on this departure; a category without one cannot be picked here. */
  prices: BookingPriceView[]
}

/** `ProductPageView.booking`: a dated product's buy form in place of "add to cart". */
export interface BookingView {
  categories: BookingCategoryView[]
  /** Soonest first; none: "new dates soon" (the page stays up). */
  departures: BookingDepartureView[]
  /** "Son N yer" is said at this many places free or fewer. */
  fewLeft: number
  /** The most places one cart may hold on a departure (the server checks again). */
  maxUnits: number
}

/** A dated cart line (`CartLineView.booking`): when, and whether its places are still held. */
export interface CartLineBookingView {
  /** "Cumartesi, 12 Aralık 2026 · 09:00", in the product's time zone. */
  departure: string
  /** The hold ran out: the line reads "Süresi doldu — yeniden seçin", the payment waits. */
  expired: boolean
}

/** The cart's hold on its dated lines' places (`CartPageView.hold`, `CheckoutView.hold`). */
export interface BookingHoldView {
  /** When the places go back (ISO 8601); null: already gone. */
  expiresAt: string | null
}

/**
 * A dated product's card (`ProductCardView.booking`, adr/0076 §10): its
 * `price` is then the lowest paying price over the departures on sale
 * (`from: true`), said "…'den itibaren", and under it the nearest
 * departure or "new dates soon". A theme without it draws the price as
 * any "from" price.
 */
export interface CardBookingView {
  /** The nearest departure on sale, short, in the product's time zone ("12 Ara"); null: none now. */
  next: string | null
  /** The same moment for `<time dateTime>` (ISO 8601); null with `next`. */
  nextAt: string | null
}

/**
 * One departure of a dated order on its page (`OrderPageView.bookings`,
 * adr/0076 Ek D7a): when, what, and what cancelling it now gives back as
 * the backend works it out. The cancel is asked first, then confirmed
 * (`OrderActions.cancelBooking`, the departure alone is sent).
 */
export interface OrderBookingView {
  slotId: string
  /** "Cumartesi, 12 Aralık 2026 · 09:00", in the product's time zone. */
  departure: string
  /** The lines on it, joined ("Kapadokya turu: Yetişkin"). */
  titles: string
  cancelled: boolean
  /** The shopper may cancel it now (the backend decides again). */
  cancellable: boolean
  /** What cancelling now gives back, with the share kept, in words; null when not cancellable. */
  refund: string | null
  /** When the money comes, in words ("İade 14 gün içinde"); null: as the payment provider does. */
  refundNote: string | null
  /** Why not, in words; null: cancellable or already cancelled. */
  note: string | null
}
