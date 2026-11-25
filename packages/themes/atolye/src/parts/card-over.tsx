import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { BookingDuration, BookingNext, BookingPrice } from "./card-booking"
import { CardBadges, isOut, quickAddWords } from "./card-parts"
import { CardPhoto } from "./CardPhoto"
import { CardQuickView } from "./card-quick-view"
import { CardPriceRow } from "./card-rows"
import { QuickAdd } from "./QuickAdd"

/**
 * A standard card with its words over the photo (adr/0077 Ek "tur
 * kartı", the shop's `text_position: over`): the photo fills the card;
 * at its foot, on a graphite fade dark enough for the stage's light ink
 * (`card-over.css`), the brand, the name on two lines, the price on its
 * own line under it (never squeezed beside the name, so neither breaks)
 * and a dated product's length and nearest departure. The stars stand as
 * a pill on the photo (no row here). One link,
 * the name's, over the whole card; the quick add and quick view above it
 * as on today's card, the words kept clear of the round "+".
 */
export function OverCard({
  product,
  t,
  quickAdd,
  priority,
  sizes,
}: {
  product: ProductCardView
  t: Translate
  quickAdd?: FormAction | undefined
  priority: boolean
  sizes: string
}) {
  const out = isOut(product)
  const add = quickAdd && product.quickAdd && !out ? product.quickAdd : null
  const split = !!product.look?.split
  return (
    <article
      className="group gf-card gf-card-over @container relative h-full"
      data-split={split ? "" : undefined}
    >
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-media">
        <CardPhoto product={product} sizes={sizes} priority={priority} />
        {split ? (
          <SplitWords product={product} t={t} add={!!add} />
        ) : (
          <div
            className="gf-card-over-text flex min-w-0 flex-col gap-1 px-3 pt-16 pb-3 data-add:pr-16"
            data-add={add ? "" : undefined}
          >
            {product.brand && <p className="truncate text-xs text-text-2">{product.brand}</p>}
            <h3 className="text-sm leading-snug font-semibold tracking-normal lg:@min-[16rem]:text-md">
              <a
                href={product.path}
                className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
              >
                {product.title}
              </a>
            </h3>
            {product.booking ? (
              <BookingPrice product={product} t={t} />
            ) : (
              <CardPriceRow product={product} t={t} />
            )}
            {product.booking && (
              <>
                <BookingDuration product={product} />
                <BookingNext product={product} t={t} />
              </>
            )}
          </div>
        )}
        <CardBadges product={product} t={t} />
        <CardQuickView product={product} t={t} />
        {add && quickAdd && (
          <QuickAdd
            variantId={add.variantId}
            path={product.path}
            action={quickAdd}
            words={quickAddWords(t, product.title)}
          />
        )}
      </div>
    </article>
  )
}

/** A price without its kuruş when they are none ("4.900,00 TL" → "4.900 TL"); any other kept whole. */
export const shortPrice = (price: string): string => price.replace(/,00(?=\D*$)/, "")

/**
 * The split card's words (`text_position: over_split`): the name and its
 * subtitle at the left, each on one line, and the price in short at the
 * right in the accent colour (`card-over.css`); a reader hears the whole
 * price, a dated product's "…'den itibaren" with it. No rows under them.
 */
function SplitWords({ product, t, add }: { product: ProductCardView; t: Translate; add: boolean }) {
  const price = product.price?.current ?? null
  return (
    <div
      className="gf-card-over-text flex min-w-0 items-end gap-3 px-4 pt-16 pb-4 data-add:pr-16"
      data-add={add ? "" : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="text-sm leading-snug font-bold tracking-normal lg:@min-[16rem]:text-md">
          <a
            href={product.path}
            className="block truncate no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        {product.subtitle && <p className="truncate text-xs text-text-2">{product.subtitle}</p>}
      </div>
      {price && (
        <p className="gf-card-split-price shrink-0 text-lg leading-none font-extrabold tabular">
          <span aria-hidden="true">{shortPrice(price)}</span>
          <span className="sr-only">
            {product.booking ? t("booking.card_from", { price }) : price}
          </span>
        </p>
      )}
    </div>
  )
}
