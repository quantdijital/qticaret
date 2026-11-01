import { ResponsiveImage } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { Price } from "./Price"

/** One product in a grid: a real link around the picture and the name. */
export function ProductCard({
  product,
  t,
  priority = false,
}: {
  product: ProductCardView
  t: Translate
  priority?: boolean
}) {
  return (
    <article className="flex flex-col gap-2">
      <a href={product.path} className="group flex flex-col gap-2">
        <div className="aspect-square overflow-hidden rounded-lg bg-subtle">
          {product.image ? (
            <ResponsiveImage
              image={product.image}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              priority={priority}
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {t("product.no_image")}
            </div>
          )}
        </div>
        {product.brand && (
          <p className="text-xs uppercase tracking-wide text-muted">{product.brand}</p>
        )}
        <h3 className="text-sm font-medium leading-snug group-hover:underline">{product.title}</h3>
      </a>
      {product.price && <Price price={product.price} t={t} />}
      {!product.available && <p className="text-xs text-muted">{t("product.out_of_stock")}</p>}
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
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} t={t} priority={index < eager} />
        </li>
      ))}
    </ul>
  )
}
