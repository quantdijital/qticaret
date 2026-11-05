import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { ProductCard } from "../parts/ProductCard"

/**
 * Products to add under the cart (the shop's best sellers, else its
 * newest; never one already in it), each card's "+" its quick add. A
 * row of four on a desktop; on a phone a rail that scrolls sideways, two
 * cards and a part of the third in sight.
 */
export function Upsell({
  title,
  products,
  t,
  quickAdd,
}: {
  title: string
  products: readonly ProductCardView[]
  t: Translate
  quickAdd: FormAction
}) {
  if (products.length === 0) {
    return null
  }
  return (
    <section aria-labelledby="sepete-ekle" className="flex flex-col gap-6 lg:gap-8">
      <h2 id="sepete-ekle">{title}</h2>
      <ul className="gf-rail -mx-(--gutter) grid auto-cols-[44%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) sm:auto-cols-[30%] lg:mx-0 lg:grid-flow-row lg:grid-cols-[repeat(4,minmax(0,1fr))] lg:overflow-visible lg:px-0">
        {products.map((product) => (
          <li key={product.id} className="min-w-0">
            <ProductCard product={product} t={t} quickAdd={quickAdd} />
          </li>
        ))}
      </ul>
    </section>
  )
}
