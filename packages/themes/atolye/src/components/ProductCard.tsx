import { Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Price } from "./Price"

/**
 * One product in a grid (design.md § Product card): the picture in a sand
 * well at the shop's ratio, never filtered and never greyed when sold
 * out; a square label at the top left for a discount or "Tükendi"; the
 * brand small in the quiet ink, the name on two lines, the stars when the
 * view carries them, the price. One link over the whole card; on hover
 * the name is underlined, the picture does not move.
 * TODO(adr/0013 ek, denetim §7): quick add (a single-variant card's
 * variant id) and the low-stock bucket wait for the contract.
 */
export function ProductCard({
  product,
  t,
  priority = false,
  large = false,
}: {
  product: ProductCardView
  t: Translate
  priority?: boolean
  /** Three across (the home page's shelf): the name at the item-title size from 768 px. */
  large?: boolean
}) {
  const discount = product.price?.discount ?? null
  return (
    <article className="relative flex h-full flex-col gap-3">
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
        {(!product.available || discount !== null) && (
          <span
            className={cn(
              "absolute top-0 left-0 px-2 py-1 text-xs font-medium",
              product.available ? "tabular bg-discount text-discount-ink" : "bg-paper text-text"
            )}
          >
            {product.available
              ? t("product.discount", { percent: discount ?? 0 })
              : t("product.out_of_stock")}
          </span>
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
}: {
  products: readonly ProductCardView[]
  t: Translate
  /** How many of the first cards load at once (the first row near the top). */
  eager?: number
  columns?: 3 | 4
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-(--gap-columns)",
        columns === 4 && "xl:grid-cols-4"
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} t={t} priority={index < eager} large={columns === 3} />
        </li>
      ))}
    </ul>
  )
}
