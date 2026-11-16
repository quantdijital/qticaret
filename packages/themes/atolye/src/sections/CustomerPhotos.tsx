import { ResponsiveImage } from "@qticaret/ui"
import type { CustomerPhotoView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Stars } from "../parts/Stars"

/**
 * The customers' own photographs from their approved reviews: a rail of
 * square frames that runs past the container's edge on a phone and fills
 * six across from 1024 px; each leads to the product it shows, its stars
 * and the customer's name under it.
 */
export function CustomerPhotos({
  id,
  photos,
  t,
}: {
  id: string
  photos: readonly CustomerPhotoView[]
  t: Translate
}) {
  if (photos.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-(--head-gap-s)">
        <h2 id={id}>{t("reviews.customer_photos")}</h2>
        <ul className="gf-rail -mx-(--gutter) flex scroll-px-(--gutter) gap-(--gap-columns) overflow-x-auto px-(--gutter) lg:mx-0 lg:grid lg:grid-cols-[repeat(6,minmax(0,1fr))] lg:overflow-visible lg:px-0">
          {photos.slice(0, 12).map((photo, index) => {
            const name = photo.product?.label ?? ""
            const alt = t("reviews.customer_photo_by", { author: photo.author, product: name })
            const frame = (
              <>
                <span className="relative block aspect-square overflow-hidden rounded-media bg-media">
                  <ResponsiveImage
                    image={{ ...photo.image, alt }}
                    sizes="(min-width: 1024px) 15vw, 40vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </span>
                <span className="flex items-center gap-2 text-xs text-text-2">
                  <Stars rating={photo.rating} />
                  <span className="truncate">{photo.author}</span>
                </span>
              </>
            )
            return (
              <li
                key={`${photo.image.src}:${String(index)}`}
                className="w-[40%] shrink-0 sm:w-[28%] lg:w-auto"
              >
                {photo.product ? (
                  <a href={photo.product.path} className="flex flex-col gap-2 no-underline">
                    {frame}
                  </a>
                ) : (
                  <div className="flex flex-col gap-2">{frame}</div>
                )}
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
