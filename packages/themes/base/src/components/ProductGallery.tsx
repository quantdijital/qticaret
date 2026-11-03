import { ImageOff } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"

/**
 * The product's pictures without a script: on phones a row that snaps
 * picture by picture, on wide screens the first one large and the rest in
 * two columns. Only the first loads eagerly (LCP, docs/03 F18).
 *
 * The row holds nothing to focus, so where it scrolls (two pictures or
 * more) the labelled row itself takes the focus and the arrow keys scroll
 * it (WCAG 2.1.1, axe scrollable-region-focusable). The row is the scroll
 * container and the list's flex parent, so its end padding stays after the
 * last picture; a picture's width is the row's (`cqw`), not the list's.
 */
export function ProductGallery({
  images,
  label,
  noImage,
  initial,
}: {
  images: ImageView[]
  label: string
  noImage: string
  /** The product's first letter, shown large while it has no picture. */
  initial: string
}) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border bg-gradient-to-br from-card to-muted text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="font-heading text-[10rem] leading-none text-foreground/10"
        >
          {initial}
        </span>
        <span className="flex items-center gap-1.5">
          <ImageOff className="size-4" aria-hidden="true" />
          {noImage}
        </span>
      </div>
    )
  }
  return (
    <section
      aria-label={label}
      tabIndex={images.length > 1 ? 0 : undefined}
      // On phones the row meets the screen's edges: the focus ring sits inside
      className="@container -mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 focus-visible:-outline-offset-2 sm:mx-0 sm:px-0 sm:focus-visible:outline-offset-2 lg:block lg:overflow-visible"
    >
      <ul className="flex flex-none gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
        {images.map((image, index) => (
          <li
            key={image.src}
            className={
              index === 0
                ? "w-[88cqw] shrink-0 snap-center sm:w-[100cqw] lg:col-span-2 lg:w-auto"
                : "w-[88cqw] shrink-0 snap-center sm:w-[100cqw] lg:w-auto"
            }
          >
            <div className="aspect-square overflow-hidden rounded-3xl border bg-card">
              <ResponsiveImage
                image={image}
                sizes={
                  index === 0 ? "(min-width: 1024px) 50vw, 90vw" : "(min-width: 1024px) 25vw, 90vw"
                }
                priority={index === 0}
                className="h-full w-full object-cover"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
