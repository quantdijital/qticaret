import { BadgeCheck } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"
import type { RatingBarView, ReviewFilterView, ShopRatingView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { fillOf } from "../parts/FreeShippingMeter"
import { Stars } from "../parts/Stars"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/**
 * How long a quote may run (sahip 2026-11-14: about two short sentences,
 * "göründüğü gibi keskinliği iyi … ürüne detay katıyor"), so the cards in
 * a row stay even. A longer one ends at a word with "…"; the section's
 * link leads to the reviews page, where every review is whole.
 */
const QUOTE = 140

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
    <div className="flex flex-1 flex-col gap-5 rounded-tile border border-rule p-6 lg:p-8">
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
 * count and the spread in a hairline box (only when the storefront has
 * the shop-wide summary), beside the three newest reviews as quotes in the
 * same boxes, each as tall as its words (the stars, the review up to about
 * 140 characters, cut at a word with "…", the name with its
 * verified-purchase mark, the product it is about as a link; Tezgâh audit
 * K-25). Nothing is written for the shop.
 */
export function Reviews({ section, t }: { section: Of<"reviews">; t: Translate }) {
  const id = headingId(section.id)
  const summary = section.summary ?? null
  const reviews = section.reviews.slice(0, 3)
  if (reviews.length === 0 && !summary) {
    return null
  }
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={section.title} more={section.more} marks={section.editor} />
        <div className="grid gap-(--gap-columns) lg:grid-cols-12">
          {summary && (
            <div className="flex lg:col-span-4">
              <Summary summary={summary} t={t} />
            </div>
          )}
          {reviews.length > 0 && (
            <ul
              // A phone slides the reviews sideways, the next one peeking, instead of a long column (third audit Z-08);
              // the cards in a row (or the rail) take one height, the summary's too
              className={cn(
                "gf-rail grid gap-(--gap-columns) max-md:-mx-(--gutter) max-md:auto-cols-[85%] max-md:grid-flow-col max-md:overflow-x-auto max-md:scroll-px-(--gutter) max-md:px-(--gutter) max-md:py-1 md:grid-cols-[repeat(3,minmax(0,1fr))]",
                summary ? "lg:col-span-8" : "lg:col-span-12"
              )}
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
                      // Which tool it is about (Tezgâh audit K-25: a catalogue labels its items)
                      <a
                        href={review.product.path}
                        className="gf-link line-clamp-2 self-start text-text-2"
                        aria-label={`${t("reviews.about")}: ${review.product.label}`}
                      >
                        {review.product.label}
                      </a>
                    )}
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
