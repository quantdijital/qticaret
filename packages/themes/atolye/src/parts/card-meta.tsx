import { CalendarDays } from "lucide-react"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { CardBadges } from "./card-parts"
import { DurationWords, RatingWords, durationOf } from "./card-pill"

const PILL =
  "gf-card-glass-pill flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold whitespace-nowrap"

/**
 * A standard card's details on its photo (`meta_place: over`, sahip
 * 2026-11-26): frosted pills (`card-glass.css`) with a small icon each, the
 * stars with their count ("★ 4,8 (12)") at the top right; a dated card's
 * length ("5 gün • 4 gece") and its nearest departure ("En yakın: 12
 * Ara", "Son 3 yer" after it) at the bottom left while the words stand
 * under the photo (`foot`), else under the stars. Each only when the
 * product has it; a reader hears what the rows said. The pills let a
 * click through to the card's one link.
 */
export function CardMeta({
  product,
  t,
  foot,
  add = false,
}: {
  product: ProductCardView
  t: Translate
  /** The photo's foot is free (the words under it): the length and date go there. */
  foot: boolean
  /** A round "+" stands at the bottom right: the foot's pills keep clear of it. */
  add?: boolean
}) {
  const rating = product.rating ? (
    <li className={PILL}>
      <RatingWords product={product} plain />
    </li>
  ) : null
  const duration = durationOf(product)
  const dated = [
    duration ? (
      <li key="duration" className={PILL}>
        <DurationWords duration={duration} plain />
      </li>
    ) : null,
    product.booking ? (
      <li key="next" className={PILL}>
        <NextWords product={product} t={t} />
      </li>
    ) : null,
  ].filter((pill) => pill !== null)
  const list = "gf-card-meta pointer-events-none flex gap-1"
  const top = foot ? (rating ? [rating] : []) : rating ? [rating, ...dated] : dated
  // The shop's badges and the stars share the photo's top row: on a narrow
  // card (a phone's two columns) the stars wrap under the badges, at the right
  return (
    <>
      <div className="pointer-events-none absolute top-2 right-2 left-2 flex flex-wrap items-start justify-between gap-1">
        <CardBadges product={product} t={t} inline />
        {top.length > 0 && (
          <ul className={`${list} ms-auto max-w-full flex-col items-end`}>{top}</ul>
        )}
      </div>
      {foot && dated.length > 0 && (
        <ul
          className={`${list} absolute bottom-2 left-2 flex-wrap ${add ? "right-14" : "right-2"}`}
          data-foot=""
        >
          {dated}
        </ul>
      )}
    </>
  )
}

/** The departure's words as the card's row says them, after a calendar. */
function NextWords({ product, t }: { product: ProductCardView; t: Translate }) {
  const booking = product.booking
  if (!booking) {
    return null
  }
  return (
    <>
      <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
      {booking.next && booking.nextAt ? (
        <time dateTime={booking.nextAt}>
          {t(booking.inRange ? "booking.card_in_range" : "booking.card_next", {
            date: booking.next,
          })}
        </time>
      ) : (
        <span>{t("booking.soon")}</span>
      )}
      {booking.next && booking.left !== undefined && (
        <span>
          <span aria-hidden="true">· </span>
          {t("booking.few_left", { count: booking.left })}
        </span>
      )}
    </>
  )
}
