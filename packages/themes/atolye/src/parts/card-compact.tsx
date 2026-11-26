import type { ProductCardView, Translate } from "@qticaret/ui"
import { CardArrow } from "./card-arrow"
import { BookingNext, BookingPrice } from "./card-booking"
import { ratingBadged } from "./card-parts"
import { DurationWords, RatingWords, durationOf } from "./card-pill"
import { CardPriceRow, CardStars } from "./card-rows"

/**
 * The words under a compact card's photo (`density: compact`, sahip
 * 2026-11-26, the tour sites' card): the brand, the name on two lines, the
 * price at once under it (the arrow beside it while the shop shows one),
 * then on one line the stars' average with its count ("★ 4,8 (12)") and a
 * dated product's length ("5 gün • 4 gece"), wrapping on a narrow card;
 * a dated product's nearest departure under them. Without reviews the
 * stars' place is the shop's no-reviews choice, as on today's card; the
 * stars on the photo's pill when the shop puts them there.
 */
export function CompactWords({ product, t }: { product: ProductCardView; t: Translate }) {
  const duration = durationOf(product)
  const rated = !!product.rating && !ratingBadged(product)
  const price = product.booking ? (
    <BookingPrice product={product} t={t} className="min-w-0" />
  ) : (
    <CardPriceRow product={product} t={t} className="min-w-0" />
  )
  return (
    <div className="flex flex-1 flex-col gap-1">
      {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
      <h3 className="text-sm leading-snug font-semibold tracking-normal lg:@min-[16rem]:text-md">
        <a
          href={product.path}
          className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
        >
          {product.title}
        </a>
      </h3>
      {product.look?.arrow ? (
        <div className="flex items-center justify-between gap-2">
          {price}
          <CardArrow />
        </div>
      ) : (
        price
      )}
      {(rated || duration) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-2">
          {rated && <RatingWords product={product} />}
          {rated && duration && <span aria-hidden="true">·</span>}
          {duration && <DurationWords duration={duration} />}
        </p>
      )}
      {!product.rating && <CardStars product={product} t={t} />}
      {product.booking && <BookingNext product={product} t={t} />}
    </div>
  )
}
