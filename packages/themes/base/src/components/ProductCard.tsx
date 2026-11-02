import { ArrowUpRight, Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Price } from "./Price"

/**
 * One product in a grid or a rail: one link around the picture and the
 * name; the discount and "sold out" as labels on the picture, a quiet
 * "view" cue that rises on hover. The picture's shape is the shop's
 * (`--card-ratio`, adr/0053 §B); the brand and the stars show when the
 * storefront put them in the view.
 */
export function ProductCard({
  product,
  t,
  priority = false,
}: {
  product: ProductCardView
  t: Translate
  priority?: boolean
}) {
  const discount = product.price?.discount ?? null
  return (
    <article className="group relative flex h-full flex-col gap-3.5">
      <div className="relative aspect-card overflow-hidden rounded-2xl border bg-card">
        {product.image ? (
          <ResponsiveImage
            image={product.image}
            sizes="(min-width: 1280px) 320px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className={cn(
              "h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]",
              !product.available && "opacity-55 grayscale"
            )}
          />
        ) : (
          // No picture yet: the name's first letter, quiet, in the display face
          <div
            aria-hidden="true"
            className="font-heading flex h-full items-center justify-center bg-gradient-to-br from-muted/40 to-muted text-8xl text-foreground/10 transition-transform duration-700 group-hover:scale-[1.05]"
          >
            {product.title.trim().charAt(0).toLocaleUpperCase("tr")}
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {discount !== null && product.available && (
            <span className="tabular rounded-full bg-sale px-2.5 py-1 text-[11px] font-semibold text-sale-foreground">
              {t("product.discount", { percent: discount })}
            </span>
          )}
          {!product.available && (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              {t("product.out_of_stock")}
            </span>
          )}
        </div>
        <span
          aria-hidden="true"
          className="absolute right-3 bottom-3 flex size-10 translate-y-2 items-center justify-center rounded-full bg-background/95 opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-0.5">
        {product.brand && (
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {product.brand}
          </p>
        )}
        <h3 className="line-clamp-2 text-[15px] leading-snug font-medium">
          {/* The whole card is the link's target; one link, one name for it */}
          <a href={product.path} className="after:absolute after:inset-0 after:content-['']">
            {product.title}
          </a>
        </h3>
        {product.rating && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-current text-foreground" aria-hidden="true" />
            <span aria-hidden="true" className="tabular font-medium text-foreground">
              {product.rating.average}
            </span>
            <span aria-hidden="true" className="tabular">
              ({product.rating.count})
            </span>
            <span className="sr-only">{product.rating.label}</span>
          </p>
        )}
        {product.price && <Price price={product.price} t={t} className="mt-auto pt-1.5" />}
      </div>
    </article>
  )
}

export function ProductGrid({
  products,
  t,
  eager = 0,
  columns = 4,
}: {
  products: ProductCardView[]
  t: Translate
  eager?: number
  /** Columns on wide screens: three beside a filter panel. */
  columns?: 3 | 4
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 lg:gap-x-6",
        columns === 4 ? "lg:grid-cols-4" : "xl:grid-cols-3"
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} t={t} priority={index < eager} />
        </li>
      ))}
    </ul>
  )
}
