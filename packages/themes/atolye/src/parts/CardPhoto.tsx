import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView, ProductCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The photo of a card with a second one (`card.css`), on every variant
 * (sahip 2026-11-18): with a mouse the second fades in over the first on
 * hover, and on keyboard focus anywhere in the card; on a touch screen the
 * two sit side by side and swipe (`swipe`, a large card's), a link to the
 * product so a tap still opens it (the eye's duplicate of the name's link:
 * hidden from a screen reader, no tab stop). A small photo (`swipe` off:
 * the compact card's, a ranked place's) keeps the first on a touch screen.
 * The second loads lazily, never with the first paint; both fill the
 * well, so nothing shifts. The photos after the second, while the shop
 * cycles them (`more`, sahip 2026-11-26), follow it in turn under a
 * resting mouse (`frame/CardCycle.tsx`); out of the layout until just
 * before their turn, so none is fetched sooner, and never on a touch
 * screen.
 */
function Photos({
  first,
  second,
  more,
  path,
  sizes,
  priority,
  swipe,
}: {
  first: ImageView
  second: ImageView
  more: readonly ImageView[]
  path: string
  sizes: string
  priority: boolean
  swipe: boolean
}) {
  return (
    <>
      <a
        href={path}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("gf-card-slides", !swipe && "gf-card-slides--hover")}
        data-cycle={more.length > 0 ? "" : undefined}
      >
        <span className="gf-card-slide">
          <ResponsiveImage
            image={first}
            sizes={sizes}
            priority={priority}
            className="h-full w-full object-cover"
          />
        </span>
        <span className="gf-card-slide gf-card-slide--second">
          <ResponsiveImage image={second} sizes={sizes} className="h-full w-full object-cover" />
        </span>
        {more.map((image, index) => (
          <span key={`${image.src}-${String(index)}`} className="gf-card-slide gf-card-slide--more">
            <ResponsiveImage image={image} sizes={sizes} className="h-full w-full object-cover" />
          </span>
        ))}
      </a>
      {swipe && (
        <span className="gf-card-dots" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
    </>
  )
}

/**
 * A card's photograph in its well: the two photos when the storefront
 * sends a second (`secondImage`), the rest after them when it sends those
 * (`morePhotos`), else the one; nothing without a photo.
 */
export function CardPhoto({
  product,
  sizes,
  priority = false,
  swipe = true,
}: {
  product: ProductCardView
  sizes: string
  priority?: boolean
  swipe?: boolean
}) {
  if (!product.image) {
    return null
  }
  if (product.secondImage) {
    return (
      <Photos
        first={product.image}
        second={product.secondImage}
        more={product.morePhotos ?? []}
        path={product.path}
        sizes={sizes}
        priority={priority}
        swipe={swipe}
      />
    )
  }
  return (
    <ResponsiveImage
      image={product.image}
      sizes={sizes}
      priority={priority}
      className="h-full w-full object-cover"
    />
  )
}
