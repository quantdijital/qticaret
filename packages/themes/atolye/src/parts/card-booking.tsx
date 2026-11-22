import { CalendarDays } from "lucide-react"
import type { ProductCardView, Translate } from "@qticaret/ui"

/**
 * A dated product's price row (adr/0076 §10): its lowest paying price as
 * "1.750,00 TL'den itibaren", in the card price's own type, and under it
 * the nearest departure on sale ("En yakın: 12 Ara") or "Yakında yeni
 * tarihler". Drawn only on a card that carries `booking`; every other
 * card's row is as it was.
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
      {product.price && (
        <p className="tabular text-md font-extrabold tracking-[-0.01em] lg:@min-[16rem]:text-lg">
          {t("booking.card_from", { price: product.price.current })}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-text-2">
        <CalendarDays
          className="size-4 shrink-0 text-text-3"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {booking.next && booking.nextAt ? (
          <time dateTime={booking.nextAt}>{t("booking.card_next", { date: booking.next })}</time>
        ) : (
          <span>{t("booking.soon")}</span>
        )}
      </p>
    </div>
  )
}
