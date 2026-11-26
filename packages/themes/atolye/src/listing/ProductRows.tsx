import type { ProductCardView, Translate } from "@qticaret/ui"
import { BookingDuration, BookingNext, BookingPrice } from "../parts/card-booking"
import { CardBadges } from "../parts/card-parts"
import { CardPriceRow, CardStars } from "../parts/card-rows"
import { CardPhoto } from "../parts/CardPhoto"

/** How wide a row's photo shows: 112 px on a phone, 224 px from 640 px, 288 px from 1024 px. */
const SIZES = "(min-width: 1024px) 288px, (min-width: 640px) 224px, 112px"

/**
 * One product to a row (a listing's `list` layout, a tour operator's
 * list): its photo on the left in the shop's corner, its name, stars,
 * length and nearest departure in the middle, its price and a "İncele"
 * that looks like a button on the right. One link over the whole row, as
 * on a card. On a phone the photo stays small on the left and the price
 * row goes under the words: never a sideways scroll.
 */
function ProductRow({
  product,
  t,
  priority,
}: {
  product: ProductCardView
  t: Translate
  priority: boolean
}) {
  return (
    <article className="group gf-card @container relative grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-media gf-box p-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-5 sm:p-3 lg:grid-cols-[18rem_minmax(0,1fr)_minmax(10rem,auto)]">
      <div className="gf-card-media relative row-span-2 aspect-[4/3] self-start overflow-hidden rounded-inner bg-media lg:row-span-1">
        <CardPhoto product={product} sizes={SIZES} priority={priority} swipe={false} />
        <div className="max-sm:hidden">
          <CardBadges product={product} t={t} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:py-1">
        {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold tracking-normal sm:text-md lg:text-lead">
          <a
            href={product.path}
            className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        <CardStars product={product} t={t} />
        <BookingDuration product={product} />
        <BookingNext product={product} t={t} />
        {product.badge && (
          <p className="sm:hidden">
            <span className="rounded-pill bg-signal px-2 py-0.5 text-2xs font-extrabold text-signal-ink">
              {product.badge.text}
            </span>
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 lg:col-start-3 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-rule lg:pl-5 lg:text-right">
        <PriceOnly product={product} t={t} />
        <span
          aria-hidden="true"
          className="gf-btn gf-btn--small max-sm:hidden lg:w-full lg:justify-center"
        >
          {t("listing.view_details")}
        </span>
      </div>
    </article>
  )
}

/**
 * The row's price: a dated product's from price alone (its departure is
 * in the middle), any other product's price row as on its card.
 */
function PriceOnly({ product, t }: { product: ProductCardView; t: Translate }) {
  return product.booking ? (
    <BookingPrice product={product} t={t} className="lg:justify-end" />
  ) : (
    <CardPriceRow product={product} t={t} />
  )
}

/**
 * The listing's products one to a row, the first `eager` photos loaded
 * at once (the page's LCP), as the grid's are.
 */
export function ProductRows({
  products,
  t,
  eager = 0,
}: {
  products: readonly ProductCardView[]
  t: Translate
  eager?: number
}) {
  return (
    <ul className="flex flex-col gap-(--gap-rows)">
      {products.map((product, index) => (
        <li key={product.id} className="min-w-0">
          <ProductRow product={product} t={t} priority={index < eager} />
        </li>
      ))}
    </ul>
  )
}
