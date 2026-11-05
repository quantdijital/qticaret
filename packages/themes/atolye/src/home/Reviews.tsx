import { Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CustomerPhotoView, ReviewPhotoView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { headingId } from "./Opening"
import type { Of } from "./plan"
import { SectionHead } from "./SectionHead"

/** A review's own photos as 72 px squares, each opening the full picture (adr/0037 §4 Ek 2026-11-04). */
function ReviewPhotos({ photos, label }: { photos: readonly ReviewPhotoView[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {photos.map((photo) => (
        <li key={photo.image.src}>
          <a
            href={photo.image.src}
            target="_blank"
            rel="noopener"
            className="at-tile block size-18 overflow-hidden bg-paper-2"
          >
            <ResponsiveImage
              image={photo.image}
              sizes="72px"
              className="h-full w-full object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  )
}

function CustomerPhoto({ photo, t }: { photo: CustomerPhotoView; t: Translate }) {
  const { product } = photo
  const picture = (alt: string) => (
    <span className="block aspect-square overflow-hidden bg-paper-2">
      <ResponsiveImage
        image={{ ...photo.image, alt }}
        sizes="(min-width: 1024px) 12vw, (min-width: 768px) 22vw, 42vw"
        className="h-full w-full object-cover"
      />
    </span>
  )
  if (!product) {
    // No live page for its product: the picture, and whose it is
    return (
      <figure className="flex flex-col gap-2">
        {picture(photo.image.alt)}
        <figcaption className="text-sm text-text-3">{photo.author}</figcaption>
      </figure>
    )
  }
  // The link is named by the picture: whose photo, of which product
  return (
    <a href={product.path} className="at-tile flex flex-col gap-2">
      {picture(t("reviews.customer_photo_by", { author: photo.author, product: product.label }))}
      <span aria-hidden="true" className="text-sm text-text-3">
        {photo.author}
      </span>
    </a>
  )
}

/**
 * The shop's customers' own photos from their approved reviews (adr/0046
 * Ek 2026-11-04), newest first: a row of squares under a hairline, each
 * at its product's page and named for it, who took it beneath. A phone
 * scrolls the row (it snaps; no script); from 1024 px eight stand in one
 * row. Lazy: the strip is below the fold. None: no strip.
 */
function CustomerPhotos({
  id,
  photos,
  t,
}: {
  id: string
  photos: readonly CustomerPhotoView[]
  t: Translate
}) {
  const linked = photos.some((photo) => photo.product !== null)
  return (
    <div className="flex flex-col gap-6 border-t border-rule pt-8">
      <h3 id={id}>{t("reviews.customer_photos")}</h3>
      <ul
        aria-labelledby={id}
        // Nothing in it takes the focus: the row itself does, so a keyboard scrolls it
        tabIndex={linked ? undefined : 0}
        className="-mx-(--gutter) flex snap-x snap-mandatory scroll-px-(--gutter) gap-4 overflow-x-auto px-(--gutter) pb-2 md:gap-(--gap-columns)"
      >
        {photos.map((photo) => (
          <li
            key={photo.image.src}
            className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[22%] lg:w-[calc((100%-7*var(--gap-columns))/8)]"
          >
            <CustomerPhoto photo={photo} t={t} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** How many of a review's words the home page quotes, its title's included. */
const QUOTED_WORDS = 12

/** The review's words up to `count`, cut at a word with an ellipsis: never rewritten. */
function excerpt(text: string, count: number): string {
  const words = text.trim().split(/\s+/)
  return words.length <= count ? text.trim() : `${words.slice(0, count).join(" ")}…`
}

/**
 * The shop's newest approved reviews (design.md § Review card), never
 * made up: three across under ink rules, the stars (read as "5 üzerinden
 * 4"), the title and the first words of the text (the whole review is on
 * the reviews page, `more`), the customer's photos when the review has
 * them, who and when, "a verified purchase" in words, and the product;
 * then the customers' other photos when the shop has any. Three quotes
 * keep the screen to about eighty words (Hallmark 58). No section is
 * drawn without a review. The home section carries no average or spread
 * of the stars, so neither is drawn here.
 */
export function ReviewsSection({ section, t }: { section: Of<"reviews">; t: Translate }) {
  if (section.reviews.length === 0) {
    return null
  }
  const id = headingId(section.id)
  const quoted = section.reviews.slice(0, 3)
  // The strip leaves out the photos the quoted reviews already show
  const shown = new Set(quoted.flatMap((review) => (review.photos ?? []).map((p) => p.image.src)))
  const photos = (section.photos ?? []).filter((photo) => !shown.has(photo.image.src))
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-10">
        <SectionHead id={id} title={section.title} more={section.more} />
        <ul className="grid gap-x-(--gap-columns) gap-y-10 md:grid-cols-3">
          {quoted.map((review, index) => (
            <li
              key={`${review.author}-${review.date}-${String(index)}`}
              className="flex flex-col gap-3 border-t-2 border-rule-ink pt-4"
            >
              <p
                className="flex gap-0.5"
                role="img"
                aria-label={t("reviews.stars", { rating: review.rating })}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <Star
                    key={star}
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={star < review.rating ? "size-4 fill-current" : "size-4 text-text-3"}
                  />
                ))}
              </p>
              {review.title && <p className="text-md font-medium">{review.title}</p>}
              <p className="max-w-[60ch] text-md text-text-2">
                {excerpt(
                  review.body,
                  Math.max(6, QUOTED_WORDS - (review.title?.trim().split(/\s+/).length ?? 0))
                )}
              </p>
              {review.photos && review.photos.length > 0 && (
                <ReviewPhotos photos={review.photos} label={t("reviews.photos")} />
              )}
              <p className="mt-auto flex flex-col text-sm text-text-3">
                <span className="font-medium text-text-2">{review.author}</span>
                <span>{review.date}</span>
                {review.verified && <span>{t("product.verified")}</span>}
                {review.product && (
                  <a href={review.product.path} className="at-inline-link self-start text-text-2">
                    {review.product.label}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
        {photos.length > 0 && <CustomerPhotos id={`${id}-fotograflar`} photos={photos} t={t} />}
      </Container>
    </section>
  )
}
