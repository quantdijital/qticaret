import { ResponsiveImage } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { badgesOf, isOut } from "./card-parts"
import { CardPriceRow, CardStars } from "./card-rows"
import { CardQuickView } from "./card-quick-view"

/** The photo's width: 80 px on a phone, 96 px from 768 px (`w-20 md:w-24`). */
const SIZES = "(min-width: 768px) 96px, 80px"

/**
 * The compact card (adr/0049 Ek 2026-11-15): the photo small on the left
 * in a rounded well at the shop's ratio, beside it the name on two lines
 * at most, the stars when the card carries them and the price (struck
 * through before a discount). A small pill on the photo for a discount or
 * "Tükendi". No add button: the whole card is one link. A `compact` or
 * `columns` rail draws its cards so; the theme setting may draw every card
 * so too.
 */
export function CompactCard({
  product,
  t,
  priority = false,
}: {
  product: ProductCardView
  t: Translate
  priority?: boolean
}) {
  const badges = badgesOf(product)
  const discount = badges.sale ? (product.price?.discount ?? null) : null
  // One pill: "Tükendi" over a discount, each as the shop shows it
  const out = isOut(product) && badges.soldOut
  return (
    <article className="group gf-card relative flex h-full items-center gap-3 md:gap-4">
      <div className="relative aspect-card w-20 shrink-0 overflow-hidden rounded-media bg-paper-2 md:w-24">
        {product.image && (
          <ResponsiveImage
            image={product.image}
            sizes={SIZES}
            priority={priority}
            className="h-full w-full object-cover"
          />
        )}
        {(discount !== null || out) && (
          <p
            className="absolute top-1 left-1 rounded-pill px-1.5 py-0.5 text-[0.6875rem] leading-none font-extrabold data-[tone=deal]:bg-deal data-[tone=deal]:text-deal-ink data-[tone=out]:bg-text data-[tone=out]:text-paper"
            data-tone={out ? "out" : "deal"}
          >
            {out ? (
              t("product.out_of_stock")
            ) : (
              <>
                <span aria-hidden="true">
                  {t("product.discount_short", { percent: discount ?? 0 })}
                </span>
                <span className="sr-only">{t("product.discount", { percent: discount ?? 0 })}</span>
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold tracking-normal">
          <a
            href={product.path}
            className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        <CardStars product={product} t={t} />
        <CardPriceRow product={product} t={t} />
      </div>
      <CardQuickView product={product} t={t} inline />
    </article>
  )
}
