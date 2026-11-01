import { ImageOff } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"

/**
 * The product's pictures without a script: on phones a row that snaps
 * picture by picture, on wide screens the first one large and the rest in
 * two columns. Only the first loads eagerly (LCP, docs/03 F18).
 */
export function ProductGallery({
  images,
  label,
  noImage,
}: {
  images: ImageView[]
  label: string
  noImage: string
}) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground">
        <ImageOff className="size-8" aria-hidden="true" />
        {noImage}
      </div>
    )
  }
  return (
    <section aria-label={label}>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible">
        {images.map((image, index) => (
          <li
            key={image.src}
            className={
              index === 0
                ? "w-[88%] shrink-0 snap-center sm:w-full lg:col-span-2"
                : "w-[88%] shrink-0 snap-center sm:w-full"
            }
          >
            <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
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
