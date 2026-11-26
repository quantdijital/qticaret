import { useId } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { MiniCartView } from "@qticaret/ui"
import { LineName, LinePhoto } from "../parts/LineLink"

type Suggestions = NonNullable<MiniCartView["suggestions"]>

/**
 * What the cart's products are bought with (S3, the shop's "Birlikte
 * alınanlar"), under the drawer's lines: a heading and a few small rows,
 * each its photograph and name (one link to its page) and its price. The
 * shopper adds one on its page. Drawn only when the shop linked some.
 */
export function CartSheetSuggestions({ suggestions }: { suggestions: Suggestions }) {
  // A header may hold two drawers (the catalog header's): each heading its own id
  const heading = useId()
  if (suggestions.products.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-2 pt-4">
      <h3 id={heading} className="text-sm font-semibold text-text-2">
        {suggestions.title}
      </h3>
      <ul className="flex flex-col gap-2">
        {suggestions.products.map((product) => (
          <li key={product.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
            <LinePhoto
              path={product.path}
              className="size-14 shrink-0 overflow-hidden rounded-inner bg-media-deep"
            >
              {product.image && (
                <ResponsiveImage
                  image={{ ...product.image, alt: "" }}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
              )}
            </LinePhoto>
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="line-clamp-2 leading-snug font-semibold">
                <LineName path={product.path} title={product.title} />
              </span>
              {product.price && (
                <span className="tabular text-text-2">{product.price.current}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
