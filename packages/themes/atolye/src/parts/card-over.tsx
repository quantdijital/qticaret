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
 * (`card-over.css`), the brand, the name on two lines and a dated
 * product's length and nearest departure on the left, the price at the
 * right. The stars stand as a pill on the photo (no row here). One link,
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
  return (
    <article className="group gf-card gf-card-over @container relative h-full">
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-media">
        <CardPhoto product={product} sizes={sizes} priority={priority} />
        <div
          className="gf-card-over-text flex items-end gap-3 px-3 pt-16 pb-3 data-add:pr-16"
          data-add={add ? "" : undefined}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {product.brand && <p className="truncate text-xs text-text-2">{product.brand}</p>}
            <h3 className="text-sm leading-snug font-semibold tracking-normal lg:@min-[16rem]:text-md">
              <a
                href={product.path}
                className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
              >
                {product.title}
              </a>
            </h3>
            {product.booking && (
              <>
                <BookingDuration product={product} />
                <BookingNext product={product} t={t} />
              </>
            )}
          </div>
          <div className="flex max-w-[55%] shrink-0 flex-col items-end text-right">
            {product.booking ? (
              <BookingPrice product={product} t={t} className="justify-end" />
            ) : (
              <CardPriceRow product={product} t={t} className="justify-end" />
            )}
          </div>
        </div>
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
