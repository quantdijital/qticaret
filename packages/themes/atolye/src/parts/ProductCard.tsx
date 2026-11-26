import type { ShelfColumns, ShelfPhoneColumns } from "@qticaret/types"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CardArrow } from "./card-arrow"
import { CompactWords } from "./card-compact"
import { OverCard } from "./card-over"
import { CardBadges, drawnCardVariant, isOut, quickAddWords, textOver } from "./card-parts"
import { CardPhoto } from "./CardPhoto"
import { CardPriceRow, CardStars } from "./card-rows"
import { CompactCard } from "./CompactCard"
import { FramedCard } from "./FramedCard"
import { QuickAdd } from "./QuickAdd"
import { CardQuickView } from "./card-quick-view"
import { shelfCard, shelfGrid, shelfSizes } from "./shelf-grid"

export { quickAddWords } from "./card-parts"

/**
 * How wide a card's photo shows, for its `sizes` (the container stops at
 * 1440 px with 48 px gutters): two across on a phone, three from 768 px;
 * a listing without its panel four from 1024 px, one beside the 280 px
 * filter panel three in what is left. A home shelf's follow the shop's
 * cards-in-a-row (`shelf-grid.ts`).
 */
const SIZES = {
  wide: "(min-width: 1440px) 318px, (min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw",
  beside:
    "(min-width: 1440px) 325px, (min-width: 1024px) calc((100vw - 23rem) / 3), (min-width: 768px) 30vw, 46vw",
} as const

/**
 * One product: its photograph in a rounded well at the shop's ratio,
 * never filtered; pills on the photo's top for a discount ("%30", the
 * reader hears "%30 indirim"), "Tükendi" or "Az kaldı" (a stock bucket,
 * never a number); the brand small, the name on two lines, the stars when
 * the card carries them, the price heavy. One link over the whole card;
 * the quick add is a round "+" on the photo's corner, above the link. The
 * product's second photo on hover when the shop has it on (`CardPhoto`).
 * The name and price take their larger size from 1024 px only on a card
 * 256 px wide or more (a container query): five across at 1440 px, or a
 * listing's four at 1024, keep the smaller one. A card the storefront
 * sends as `framed` is drawn by `FramedCard` (adr/0049 Ek 2026-11-14 §3.3),
 * one sent as `compact` by `CompactCard` (Ek 2026-11-15). The shop's
 * tour look (adr/0077 Ek "tur kartı", `look`): the words over the photo
 * (`OverCard`), a decorative arrow at the price row's end; none of it
 * on today's card, whose markup is as it was. The compact rows
 * (`density: compact`, sahip 2026-11-26) by `CompactWords`.
 */
export function ProductCard({
  product,
  t,
  quickAdd,
  priority = false,
  sizes = shelfSizes(3),
}: {
  product: ProductCardView
  t: Translate
  quickAdd?: FormAction | undefined
  /** A first-row card on a listing: its photo loads at once (LCP). */
  priority?: boolean
  /** How wide the card shows at each width (the grid's own, else a shelf's). */
  sizes?: string
}) {
  const variant = drawnCardVariant(product)
  if (variant === "framed") {
    return (
      <FramedCard product={product} t={t} quickAdd={quickAdd} priority={priority} sizes={sizes} />
    )
  }
  if (variant === "compact") {
    return <CompactCard product={product} t={t} priority={priority} />
  }
  if (textOver(product)) {
    return (
      <OverCard product={product} t={t} quickAdd={quickAdd} priority={priority} sizes={sizes} />
    )
  }
  const out = isOut(product)
  const add = quickAdd && product.quickAdd && !out ? product.quickAdd : null
  return (
    <article
      className={
        product.look?.compact
          ? "group gf-card @container relative flex h-full flex-col gap-2"
          : "group gf-card @container relative flex h-full flex-col gap-3"
      }
    >
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-media">
        <CardPhoto product={product} sizes={sizes} priority={priority} />
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
      {product.look?.compact ? (
        <CompactWords product={product} t={t} />
      ) : (
        <TodayWords product={product} t={t} />
      )}
    </article>
  )
}

/** Today's rows under the photo: the brand, the name, the stars, the price at the card's foot. */
function TodayWords({ product, t }: { product: ProductCardView; t: Translate }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
      <h3 className="text-sm leading-snug font-semibold tracking-normal lg:@min-[16rem]:text-md">
        {/* Clamped on the link itself: its box ends with the two lines shown, over nothing else */}
        <a
          href={product.path}
          className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
        >
          {product.title}
        </a>
      </h3>
      <CardStars product={product} t={t} />
      {product.look?.arrow ? (
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <CardPriceRow product={product} t={t} className="min-w-0" />
          <CardArrow />
        </div>
      ) : (
        <CardPriceRow product={product} t={t} className="mt-auto pt-1" />
      )}
    </div>
  )
}

/**
 * Cards in a grid: two across on a phone, three from 768 px, each
 * photograph large; `wide` (a listing without its side panel) four from
 * 1024 px; `beside` (next to the filter panel) three in the room left,
 * which only sets the photos' `sizes`; `columns` (a home shelf) the
 * shop's cards-in-a-row from 1280 px, stepping down below, whole rows
 * only (`shelf-grid.ts`). The first `eager` cards load their photos at
 * once (a listing's first row, its LCP).
 */
export function ProductGrid({
  products,
  t,
  quickAdd,
  wide = false,
  beside = false,
  columns,
  phone = 2,
  eager = 0,
}: {
  products: readonly ProductCardView[]
  t: Translate
  quickAdd?: FormAction | undefined
  wide?: boolean
  beside?: boolean
  columns?: ShelfColumns | undefined
  /** With `columns`: cards in a row on a phone, two by default (bilesen-denetimi (b) 3). */
  phone?: ShelfPhoneColumns | undefined
  eager?: number
}) {
  const sizes = wide ? SIZES.wide : beside ? SIZES.beside : shelfSizes(columns ?? 3, phone)
  return (
    <ul
      data-columns={columns}
      className={cn(
        "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-(--gap-columns) gap-y-(--gap-rows) md:grid-cols-[repeat(3,minmax(0,1fr))]",
        wide && "lg:grid-cols-[repeat(4,minmax(0,1fr))]",
        columns && shelfGrid(columns, phone)
      )}
    >
      {products.map((product, index) => (
        <li
          key={product.id}
          className={cn("min-w-0", columns && shelfCard(columns, products.length, index, phone))}
        >
          <ProductCard
            product={product}
            t={t}
            quickAdd={quickAdd}
            priority={index < eager}
            sizes={sizes}
          />
        </li>
      ))}
    </ul>
  )
}
