import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import type { Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Scroller } from "../parts/Scroller"
import { scrollerSizes } from "../parts/scroller-sizes"
import { type Of, headingId } from "./plan"
import { ReviewCard } from "./review-card"
import { SectionHead } from "./SectionHead"

/**
 * The reviews' `carousel` (adr/0077 §10): the newest reviews the section
 * counts, one card each in a row that slides with the scroller kit (its
 * arrows beside the head or the row, keyboard and screen reader as the
 * kit's; nothing turns by itself unless the shop says so). Each card
 * shows its customer's first photo when there is one, so the strip of
 * customer photos under the grid is not drawn here again. The quote is cut
 * as the grid's; the section's link leads to the reviews page. With
 * `product_image` each card shows the reviewed product's picture too
 * (`review-card.tsx`).
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
            <SectionHead
              id={id}
              title={section.title}
              more={section.more}
              marks={section.editor}
              lines={section}
            />
          }
        >
          {section.reviews.map((review, index) => (
            <ReviewCard
              key={`${review.author}:${review.date}:${String(index)}`}
              review={review}
              sizes={sizes}
              t={t}
              productImage={section.product_image ?? "none"}
            />
          ))}
        </Scroller>
      </Container>
    </section>
  )
}
