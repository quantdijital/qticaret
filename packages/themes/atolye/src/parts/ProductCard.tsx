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
}: {
  product: ProductCardView
  t: Translate
  quickAdd?: FormAction | undefined
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
            sizes="(min-width: 768px) 30vw, 46vw"
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
        {product.brand && <p className="text-xs text-text-3">{product.brand}</p>}
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold tracking-normal lg:text-md">
          <a
            href={product.path}
            className="no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
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

/** Cards in a grid: two across on a phone, three from 768 px, each photograph large. */
export function ProductGrid({
  products,
  t,
  quickAdd,
}: {
  products: readonly ProductCardView[]
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-(--gap-columns) gap-y-8 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-y-10"
      )}
    >
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} t={t} quickAdd={quickAdd} />
        </li>
      ))}
    </ul>
  )
}
