import { ImageOff } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { Badge } from "@qticaret/ui/components/badge"
import { cn } from "@qticaret/ui/lib/utils"
import { Price } from "./Price"

/**
 * One product in a grid or a rail: one link around the picture and the
 * name, the discount and "sold out" as badges on the picture.
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
    <article className="group relative flex h-full flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {product.image ? (
          <ResponsiveImage
            image={product.image}
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className={cn(
              "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]",
              !product.available && "opacity-60"
            )}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
            {t("product.no_image")}
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {discount !== null && product.available && (
            <Badge className="bg-sale text-sale-foreground">
              {t("product.discount", { percent: discount })}
            </Badge>
          )}
          {!product.available && <Badge variant="secondary">{t("product.out_of_stock")}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {product.brand && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {product.brand}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          {/* The whole card is the link's target; one link, one name for it */}
          <a href={product.path} className="after:absolute after:inset-0 after:content-['']">
            {product.title}
          </a>
        </h3>
        {product.price && <Price price={product.price} t={t} className="mt-auto pt-1" />}
      </div>
    </article>
  )
}

export function ProductGrid({
  products,
  t,
  eager = 0,
}: {
  products: ProductCardView[]
  t: Translate
  eager?: number
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} t={t} priority={index < eager} />
        </li>
      ))}
    </ul>
  )
}
