import { CalendarDays, Clock } from "lucide-react"
import type { ProductCardView, Translate } from "@qticaret/ui"

// Joined by hand, no trailing space without a class (tailwind-merge reads the theme's sizes as colours)
const withClass = (base: string, more: string) => (more ? `${base} ${more}` : base)

/**
 * A dated product's length ("5 gün • 4 gece", adr/0077 Ek "tur kartı"),
 * while the shop shows it and the product has one; nothing otherwise.
 */
export function BookingDuration({
  product,
  className = "",
}: {
  product: ProductCardView
  className?: string
}) {
  const duration = product.look?.duration ? product.booking?.duration : undefined
  if (!duration) {
    return null
  }
  return (
    <p className={withClass("flex items-center gap-1.5 text-xs text-text-2", className)}>
      <Clock className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
      <span>{duration}</span>
    </p>
  )
}

/**
 * A dated product's price: its lowest paying price as "1.750,00 TL'den
 * itibaren", in the card price's own type, and "kişi başı" after it while
 * the shop asks (adr/0077 Ek "tur kartı").
 */
export function BookingPrice({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  if (!product.price) {
    return null
  }
  const from = t("booking.card_from", { price: product.price.current })
  if (!product.look?.perPerson) {
    return (
      <p
        className={withClass(
          "tabular text-md font-extrabold tracking-[-0.01em] lg:@min-[16rem]:text-lg",
          className
        )}
      >
        {from}
      </p>
    )
  }
  return (
    <p className={withClass("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className="tabular text-md font-extrabold tracking-[-0.01em] lg:@min-[16rem]:text-lg">
        {from}
      </span>
      <span className="text-xs font-medium text-text-2">{t("booking.card_per_person")}</span>
    </p>
  )
}

/**
 * A dated product's price row (adr/0076 §10): its from price, then its
 * length when the shop shows it, and under them the nearest departure on
 * sale ("En yakın: 12 Ara") or "Yakında yeni tarihler". Drawn only on a
 * card that carries `booking`; every other card's row is as it was.
 */
export function BookingPriceRow({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  const booking = product.booking
  if (!booking) {
    return null
  }
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <BookingPrice product={product} t={t} />
      <BookingDuration product={product} />
      <BookingNext product={product} t={t} />
    </div>
  )
}

/** The nearest departure on sale ("En yakın: 12 Ara"), or "Yakında yeni tarihler". */
export function BookingNext({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  const booking = product.booking
  if (!booking) {
    return null
  }
  return (
    <p className={withClass("flex items-center gap-1.5 text-xs text-text-2", className)}>
      <CalendarDays className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
      {booking.next && booking.nextAt ? (
        <time dateTime={booking.nextAt}>{t("booking.card_next", { date: booking.next })}</time>
      ) : (
        <span>{t("booking.soon")}</span>
      )}
    </p>
  )
}
