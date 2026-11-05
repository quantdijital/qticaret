import { ResponsiveImage } from "@qticaret/ui"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Price } from "./Price"
import { QuickAdd, type QuickAddWords } from "./QuickAdd"
import { Stars } from "./Stars"

/** The add-to-cart action's message keys a quick add can come back with. */
const QUICK_ADD_ERRORS = [
  "cart.add_failed",
  "cart.quantity_invalid",
  "cart.payment_link_locked",
  "errors.too_many_requests",
] as const

/** A quick add's words for a product. */
export const quickAddWords = (t: Translate, title: string): QuickAddWords => ({
  add: t("product.quick_add"),
  label: t("product.quick_add_label", { title }),
  added: t("product.quick_added"),
  errors: {
    ...Object.fromEntries(QUICK_ADD_ERRORS.map((key) => [key, t(key)])),
    "cart.variant_unavailable": t("product.quick_add_unavailable"),
  },
  openPage: t("product.quick_add_open"),
})

const isOut = (product: ProductCardView) => !product.available || product.stock === "out"

/**
 * How wide a card's photo shows, for its `sizes` (the container stops at
 * 1440 px with 48 px gutters): two across on a phone, three from 768 px;
 * a home shelf stays three, a listing without its panel four from 1024
 * px, one beside the 280 px filter panel three in what is left.
 */
const SIZES = {
  shelf: "(min-width: 1440px) 432px, (min-width: 768px) 30vw, 46vw",
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
 * the quick add is a round "+" on the photo's corner, above the link.
 */
export function ProductCard({
  product,
  t,
  quickAdd,
  priority = false,
  sizes = SIZES.shelf,
}: {
  product: ProductCardView
  t: Translate
  quickAdd?: FormAction | undefined
  /** A first-row card on a listing: its photo loads at once (LCP). */
  priority?: boolean
  /** How wide the card shows at each width (the grid's own, else a shelf's). */
  sizes?: string
}) {
  const out = isOut(product)
  const discount = product.price?.discount ?? null
  const add = quickAdd && product.quickAdd && !out ? product.quickAdd : null
  return (
    <article className="group relative flex h-full flex-col gap-3">
      <div className="relative aspect-card overflow-hidden rounded-media bg-paper-2">
        {product.image && (
          <ResponsiveImage
            image={product.image}
            sizes={sizes}
            priority={priority}
            className="h-full w-full object-cover"
          />
        )}
        <ul className="absolute top-2 left-2 flex flex-wrap gap-1 text-xs font-extrabold">
          {discount !== null && (
            <li className="rounded-pill bg-deal px-2 py-1 text-deal-ink">
              <span aria-hidden="true">{t("product.discount_short", { percent: discount })}</span>
              <span className="sr-only">{t("product.discount", { percent: discount })}</span>
            </li>
          )}
          {out ? (
            <li className="rounded-pill bg-text px-2 py-1 text-paper">
              {t("product.out_of_stock")}
            </li>
          ) : (
            product.stock === "low" && (
              <li className="rounded-pill bg-field px-2 py-1 text-text">{t("product.few_left")}</li>
            )
          )}
        </ul>
        {add && quickAdd && (
          <QuickAdd
            variantId={add.variantId}
            path={product.path}
            action={quickAdd}
            words={quickAddWords(t, product.title)}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold tracking-normal lg:text-md">
          {/* Clamped on the link itself: its box ends with the two lines shown, over nothing else */}
          <a
            href={product.path}
            className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        {product.rating && (
          <p className="flex items-center gap-1.5 text-xs text-text-2">
            <Stars rating={Number(product.rating.average.replace(",", "."))} />
            <span aria-hidden="true">{product.rating.average}</span>
            <span className="sr-only">{product.rating.label}</span>
          </p>
        )}
        {product.price && <Price price={product.price} t={t} className="mt-auto pt-1" />}
      </div>
    </article>
  )
}

/**
 * Cards in a grid: two across on a phone, three from 768 px, each
 * photograph large; `wide` (a listing without its side panel) four from
 * 1024 px; `beside` (next to the filter panel) three in the room left,
 * which only sets the photos' `sizes`. The first `eager` cards load
 * their photos at once (a listing's first row, its LCP).
 */
export function ProductGrid({
  products,
  t,
  quickAdd,
  wide = false,
  beside = false,
  eager = 0,
}: {
  products: readonly ProductCardView[]
  t: Translate
  quickAdd?: FormAction | undefined
  wide?: boolean
  beside?: boolean
  eager?: number
}) {
  const sizes = wide ? SIZES.wide : beside ? SIZES.beside : SIZES.shelf
  return (
    <ul
      className={cn(
        "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-(--gap-columns) gap-y-8 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-y-10",
        wide && "lg:grid-cols-[repeat(4,minmax(0,1fr))]"
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="min-w-0">
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
