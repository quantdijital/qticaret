import { BadgeCheck } from "lucide-react"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import { ResponsiveImage } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Scroller } from "../parts/Scroller"
import { scrollerSizes } from "../parts/scroller-sizes"
import { Stars } from "../parts/Stars"
import { type Of, headingId } from "./plan"
import { quoteOf } from "./Reviews"
import { SectionHead } from "./SectionHead"

type Review = Of<"reviews">["reviews"][number]

/** One review as a card: its customer's first photo when there is one, the stars, the quote, who. */
function ReviewCard({ review, sizes, t }: { review: Review; sizes: string; t: Translate }) {
  const photo = review.photos?.[0] ?? null
  return (
    <article className="flex h-full flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6">
      {photo && (
        <span className="relative -mx-2 -mt-2 block aspect-[4/3] overflow-hidden rounded-media bg-media lg:-mx-3 lg:-mt-3">
          <ResponsiveImage
            image={photo.image}
            sizes={sizes}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </span>
      )}
      <Stars rating={review.rating} label={t("reviews.stars", { rating: review.rating })} />
      <blockquote className="flex-1 text-md leading-relaxed font-semibold">
        <p>“{quoteOf(review.body)}”</p>
      </blockquote>
      <footer className="flex flex-col gap-1 pt-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-text">
          {review.author}
          {review.verified && (
            <BadgeCheck
              className="size-4 text-ok"
              role="img"
              aria-label={t("product.verified")}
              strokeWidth={2}
            />
          )}
        </span>
        {review.product && (
          <a
            href={review.product.path}
            className="gf-link line-clamp-2 self-start text-text-2"
            aria-label={`${t("reviews.about")}: ${review.product.label}`}
          >
            {review.product.label}
          </a>
        )}
      </footer>
    </article>
  )
}

/**
 * The reviews' `carousel` (adr/0077 §10): the newest reviews the section
 * counts, one card each in a row that slides with the scroller kit (its
 * arrows beside the head or the row, keyboard and screen reader as the
 * kit's; nothing turns by itself unless the shop says so). Each card
 * shows its customer's first photo when there is one, so the strip of
 * customer photos under the grid is not drawn here again. The quote is cut
 * as the grid's; the section's link leads to the reviews page.
 */
export function ReviewsCarousel({ section, t }: { section: Of<"reviews">; t: Translate }) {
  const id = headingId(section.id)
  if (section.reviews.length === 0) {
    return null
  }
  const settings = scrollerSettingsOf(section.scroller)
  const sizes = scrollerSizes(settings)
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container>
        <Scroller
          settings={settings}
          words={{
            label: section.title,
            previous: t("scroller.previous"),
            next: t("scroller.next"),
            play: t("scroller.play"),
            pause: t("scroller.pause"),
            page: t("scroller.page", { n: "{n}" }),
            pages: t("scroller.pages"),
          }}
          head={
            <SectionHead id={id} title={section.title} more={section.more} marks={section.editor} />
          }
        >
          {section.reviews.map((review, index) => (
            <ReviewCard
              key={`${review.author}:${review.date}:${String(index)}`}
              review={review}
              sizes={sizes}
              t={t}
            />
          ))}
        </Scroller>
      </Container>
    </section>
  )
}
