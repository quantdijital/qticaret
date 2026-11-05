import { Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Price } from "./Price"
import { QuickAdd, type QuickAddWords } from "./QuickAdd"

/** The add-to-cart action's message keys a quick add can come back with. */
const QUICK_ADD_ERRORS = [
  "cart.add_failed",
  "cart.quantity_invalid",
  "cart.payment_link_locked",
  "errors.too_many_requests",
] as const

/** A quick add's words for a product; `add` is the button's own (a card's one verb by default). */
export const quickAddWords = (
  t: Translate,
  title: string,
  // The plus and one verb: twelve cards say it, the name says which (Hallmark 58)
  add = t("product.quick_add_short")
): QuickAddWords => ({
  add,
  label: t("product.quick_add_label", { title }),
  added: t("product.quick_added"),
  errors: {
    ...Object.fromEntries(QUICK_ADD_ERRORS.map((key) => [key, t(key)])),
    // No option was chosen on a card: the product, not "this option", is not to be had
    "cart.variant_unavailable": t("product.quick_add_unavailable"),
  },
  openPage: t("product.quick_add_open"),
})

/**
 * A discount's share as the figure ("%30") beside a struck-through price
 * that already says it is one; the reader hears the words ("%30
 * indirim"). Twelve cards each saying "indirim" fill a window (Hallmark 58).
 */
export function DiscountBadge({ percent, t }: { percent: number; t: Translate }) {
  return (
    <>
      <span aria-hidden="true">{t("product.discount_short", { percent })}</span>
      <span className="sr-only">{t("product.discount", { percent })}</span>
    </>
  )
}

/** Sold out, by the card's own word or its stock bucket. */
const isOut = (product: ProductCardView) => !product.available || product.stock === "out"

/**
 * One product in a grid (design.md § Product card): the picture in a sand
 * well at the shop's ratio, never filtered and never greyed when sold
 * out; square labels at the top left for a discount, "Tükendi" or "Az
 * kaldı" (the stock as a bucket, adr/0046 Ek 2026-11-04, never a number);
 * the brand small in the quiet ink, the name on two lines, the stars when
 * the view carries them, the price. One link over the whole card; on
 * hover the name is underlined, the picture does not move. With the
 * page's add-to-cart and a variant to put in, the quick add sits under
 * the price, and a row of cards shares its rows (`ProductGrid`), so the
 * prices stay on one line.
 */
export function ProductCard({
  product,
  t,
  priority = false,
  large = false,
  quickAdd,
  rows = false,
}: {
  product: ProductCardView
  t: Translate
  priority?: boolean
  /** Three across (the home page's shelf): the name at the item-title size from 768 px. */
  large?: boolean
  /** The storefront's add-to-cart (adr/0046 Ek 2026-11-04); none: no quick add. */
  quickAdd?: FormAction | undefined
  /** Sit on the grid's rows (picture, words, quick add), so a row's prices line up. */
  rows?: boolean
}) {
  const discount = product.price?.discount ?? null
  const out = isOut(product)
  const few = !out && product.stock === "low"
  const quick = quickAdd && !out ? (product.quickAdd ?? null) : null
  return (
    <article
      className={
        rows ? "relative row-span-3 grid grid-rows-subgrid" : "relative flex h-full flex-col gap-3"
      }
    >
      <div className="relative aspect-card overflow-hidden bg-paper-2">
        {product.image ? (
          <ResponsiveImage
            image={product.image}
            sizes="(min-width: 1440px) 416px, (min-width: 768px) 30vw, 50vw"
            priority={priority}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full items-center justify-center font-display text-[4rem] text-text-3"
          >
            {product.title.trim().charAt(0).toLocaleUpperCase("tr")}
          </span>
        )}
        {(out || discount !== null || few) && (
          <ul className="absolute top-0 left-0 flex flex-col items-start">
            {out ? (
              <li className="bg-paper px-2 py-1 text-xs font-medium text-text">
                {t("product.out_of_stock")}
              </li>
            ) : (
              discount !== null && (
                <li className="tabular bg-discount px-2 py-1 text-xs font-medium text-discount-ink">
                  <DiscountBadge percent={discount} t={t} />
                </li>
              )
            )}
            {few && (
              <li className="bg-paper px-2 py-1 text-xs font-medium text-warn">
                {t("product.few_left")}
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {product.brand && <p className="text-xs text-text-3">{product.brand}</p>}
        <h3
          className={cn(
            "line-clamp-2 max-w-none text-card-title leading-[1.35] font-medium",
            large && "md:text-title md:leading-[1.3]"
          )}
        >
          {/* The whole card is the link's target; one link, one name for it */}
          <a
            href={product.path}
            className="at-card-link after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        {product.rating && (
          <p className="flex items-center gap-1 text-xs text-text-2">
            <Star className="size-4 fill-current" aria-hidden="true" strokeWidth={1.5} />
            <span aria-hidden="true" className="tabular">
              {product.rating.average} ({product.rating.count})
            </span>
            <span className="sr-only">{product.rating.label}</span>
          </p>
        )}
        {product.price && <Price price={product.price} t={t} className="mt-auto pt-1" />}
      </div>
      {quick && quickAdd ? (
        <QuickAdd
          variantId={quick.variantId}
          path={product.path}
          action={quickAdd}
          words={quickAddWords(t, product.title)}
        />
      ) : null}
    </article>
  )
}

/**
 * Products two across on a phone, three from 768 px and, on a listing,
 * four from 1280 px (design.md § Breakpoints); the home page's shelf
 * keeps three, its pictures larger. The grid never adds a fifth.
 */
export function ProductGrid({
  products,
  t,
  eager = 0,
  columns = 4,
  quickAdd,
}: {
  products: readonly ProductCardView[]
  t: Translate
  /** How many of the first cards load at once (the first row near the top). */
  eager?: number
  columns?: 3 | 4
  /** A card's quick add (adr/0046 Ek 2026-11-04); none: cards link to their pages only. */
  quickAdd?: FormAction | undefined
}) {
  // With a quick add on any card, each card spans three of the grid's rows
  // (subgrid): a row of cards shares its picture, words and button rows, so
  // the prices line up and a row without a button keeps no gap for one
  const rows =
    quickAdd !== undefined && products.some((product) => product.quickAdd && !isOut(product))
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-(--gap-columns)",
        columns === 4 && "xl:grid-cols-4"
      )}
    >
      {products.map((product, index) => (
        <li
          key={product.id}
          className={rows ? "row-span-3 grid grid-rows-subgrid gap-y-3" : undefined}
        >
          <ProductCard
            product={product}
            t={t}
            priority={index < eager}
            large={columns === 3}
            quickAdd={quickAdd}
            rows={rows}
          />
        </li>
      ))}
    </ul>
  )
}
