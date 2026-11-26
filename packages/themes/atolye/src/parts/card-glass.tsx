import { ArrowRight } from "lucide-react"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { BookingNext, BookingPrice } from "./card-booking"
import { CardMeta } from "./card-meta"
import { CardBadges, isOut, metaOnPhoto, quickAddWords } from "./card-parts"
import { DurationWords, RatingWords, durationOf } from "./card-pill"
import { CardPhoto } from "./CardPhoto"
import { CardQuickView } from "./card-quick-view"
import { CardPriceRow } from "./card-rows"
import { QuickAdd } from "./QuickAdd"

/**
 * The glass card (`style: glass`, sahip 2026-11-26): the photo fills the
 * card in its rounded well; at its foot a frosted panel floats with the
 * name and the price (`card-glass.css`). On hover the panel lifts a
 * little and "İncele →" shows at its right; neither moves for a visitor
 * who asks for less motion. The stars, length and departure as pills on
 * the photo while the shop puts them there (`CardMeta`), else small rows
 * in the panel. One link, the name's, over the whole card (its cover
 * reaches past the panel, clipped by the well).
 */
export function GlassCard({
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
  const meta = metaOnPhoto(product)
  return (
    <article className="group gf-card gf-card-glass @container relative h-full">
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-media">
        <CardPhoto product={product} sizes={sizes} priority={priority} />
        {meta ? (
          <CardMeta product={product} t={t} foot={false} />
        ) : (
          <CardBadges product={product} t={t} />
        )}
        <div
          className="gf-card-glass-panel absolute right-2 bottom-2 left-2 flex min-w-0 flex-col gap-1 rounded-[calc(var(--radius-media)*0.75)] px-3 py-2.5 data-add:right-14"
          data-add={add ? "" : undefined}
        >
          {product.brand && <p className="truncate text-xs text-text-2">{product.brand}</p>}
          <h3 className="text-sm leading-snug font-semibold tracking-normal lg:@min-[16rem]:text-md">
            <a
              href={product.path}
              className="line-clamp-2 no-underline after:absolute after:-inset-[100vmax] after:content-['']"
            >
              {product.title}
            </a>
          </h3>
          <div className="flex items-end justify-between gap-2">
            {product.booking ? (
              <BookingPrice product={product} t={t} className="min-w-0" />
            ) : (
              <CardPriceRow product={product} t={t} className="min-w-0" />
            )}
            <span
              className="gf-card-glass-go flex shrink-0 items-center gap-1 text-xs font-semibold @max-[13rem]:hidden"
              aria-hidden="true"
            >
              {t("listing.view_details")}
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </span>
          </div>
          {!meta && <PanelRows product={product} t={t} />}
        </div>
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

/** The stars with their count and the length on one line, the departure under them, in the panel. */
function PanelRows({ product, t }: { product: ProductCardView; t: Translate }) {
  const duration = durationOf(product)
  // The panel always carries the stars: the shop's stars' pill is for the other cards
  const rated = !!product.rating
  return (
    <>
      {(rated || duration) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-2">
          {rated && <RatingWords product={product} />}
          {rated && duration && <span aria-hidden="true">·</span>}
          {duration && <DurationWords duration={duration} />}
        </p>
      )}
      {product.booking && <BookingNext product={product} t={t} />}
    </>
  )
}
