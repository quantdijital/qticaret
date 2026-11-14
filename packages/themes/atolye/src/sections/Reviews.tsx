import { BadgeCheck } from "lucide-react"
import type { RatingBarView, ReviewFilterView, ShopRatingView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { fillOf } from "../parts/FreeShippingMeter"
import { Stars } from "../parts/Stars"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/**
 * How long a quote may run before it is cut: a few sentences, enough for
 * nearly every review in full. A longer one ends at a word with "…"; the
 * section's link leads to the reviews page, where every review is whole.
 */
const QUOTE = 360

/** A review as a quote: whole when it fits, else its words up to `QUOTE` characters and "…". */
export function quoteOf(body: string): string {
  const text = body.replace(/\s+/g, " ").trim()
  if (text.length <= QUOTE) {
    return text
  }
  const cut = text.slice(0, QUOTE)
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`
}

const BAR_ROW = "grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"

/** One bar's parts: its stars in words, the bar, the count; the words for a screen reader apart. */
function BarParts({ bar, label, t }: { bar: RatingBarView; label: string; t: Translate }) {
  return (
    <>
      <span aria-hidden="true">{t("reviews.bar_stars", { stars: bar.stars })}</span>
      <span aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-paper-3">
        <span className={`block h-full rounded-pill bg-star ${fillOf(bar.percent)}`} />
      </span>
      <span aria-hidden="true" className="tabular text-right">
        {bar.count}
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}

/**
 * The shop's average set large, the stars, the count and the spread 5 to
 * 1, on a tinted panel. With a `filter` (the reviews page, adr/0037 Ek
 * 2026-11-05) each bar is the link that shows its stars alone: a 44 px
 * row, the one shown lifted on the bench colour and set heavy; a number
 * no review gave stays a faint row, no link.
 */
export function Summary({
  summary,
  t,
  filter = null,
}: {
  summary: ShopRatingView
  t: Translate
  filter?: ReviewFilterView | null
}) {
  return (
    <div className="flex flex-col gap-5 rounded-tile bg-paper-2 p-6 lg:p-8">
      <p className="flex items-end gap-3">
        <span className="tabular text-figure leading-none font-extrabold tracking-(--tracking-display)">
          {summary.average}
        </span>
        <span className="flex flex-col gap-1 pb-1">
          <Stars rating={Number(summary.average.replace(",", "."))} size="size-5" />
          <span className="text-sm text-text-2">
            {t("reviews.count", { count: summary.count })}
          </span>
        </span>
        <span className="sr-only">{summary.label}</span>
      </p>
      {summary.distribution.length > 0 && (
        <ul
          aria-label={t(filter ? "reviews.filter_label" : "reviews.distribution")}
          className={filter ? "-mx-3 flex flex-col gap-0.5" : "flex flex-col gap-1.5"}
        >
          {summary.distribution.map((bar) => {
            const option = filter?.options.find((each) => each.stars === bar.stars)
            if (!option) {
              return (
                <li key={bar.stars} className={`${BAR_ROW} text-text-2`}>
                  <BarParts bar={bar} label={bar.label} t={t} />
                </li>
              )
            }
            return (
              <li key={bar.stars}>
                {option.path ? (
                  <a
                    href={option.path}
                    rel="nofollow"
                    aria-current={option.active ? "true" : undefined}
                    className={`${BAR_ROW} min-h-11 rounded-inner px-3 no-underline transition-colors duration-(--dur-micro) hover:bg-paper active:translate-y-px ${
                      option.active ? "bg-paper font-extrabold text-text" : "text-text-2"
                    }`}
                  >
                    <BarParts bar={bar} label={option.label} t={t} />
                  </a>
                ) : (
                  <span className={`${BAR_ROW} min-h-11 px-3 text-text-3`}>
                    <BarParts bar={bar} label={bar.label} t={t} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * The shop's approved reviews: its average set large with the stars, the
 * count and the spread on a tinted panel (only when the storefront has
 * the shop-wide summary), beside the three newest reviews as quotes (the
 * stars, the review whole (a very long one cut at a word), the name with
 * its verified-purchase mark). Nothing is written for the shop.
 */
export function Reviews({ section, t }: { section: Of<"reviews">; t: Translate }) {
  const id = headingId(section.id)
  const summary = section.summary ?? null
  const reviews = section.reviews.slice(0, 3)
  if (reviews.length === 0 && !summary) {
    return null
  }
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={section.title} more={section.more} />
        <div className="grid gap-(--gap-columns) lg:grid-cols-12">
          {summary && (
            <div className="lg:col-span-4">
              <Summary summary={summary} t={t} />
            </div>
          )}
          {reviews.length > 0 && (
            <ul
              className={
                summary
                  ? "grid gap-(--gap-columns) md:grid-cols-[repeat(3,minmax(0,1fr))] lg:col-span-8"
                  : "grid gap-(--gap-columns) md:grid-cols-[repeat(3,minmax(0,1fr))] lg:col-span-12"
              }
            >
              {reviews.map((review, index) => (
                <li
                  key={`${review.author}:${review.date}:${String(index)}`}
                  className="flex flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6"
                >
                  <Stars
                    rating={review.rating}
                    label={t("reviews.stars", { rating: review.rating })}
                  />
                  <blockquote className="text-md leading-relaxed font-semibold">
                    <p>“{quoteOf(review.body)}”</p>
                  </blockquote>
                  <footer className="mt-auto pt-2 text-sm">
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
                  </footer>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  )
}
