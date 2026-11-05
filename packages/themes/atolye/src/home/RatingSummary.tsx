import { Star } from "lucide-react"
import type { RatingBarView, ShopRatingView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { fillOf } from "../components/FreeShippingBar"

/** A bar's fill in 5% steps (no inline style under the CSP); a number given at all shows a sliver. */
const fillFor = (bar: RatingBarView) => fillOf(bar.count > 0 ? Math.max(5, bar.percent) : 0)

/**
 * The shop's reviews in short (design.md § Review card; adr/0046 Ek
 * 2026-11-05): the average in Caslon at the price's size, its stars and
 * how many reviews there are, then the spread from five stars to one as
 * 8 px ink bars over sand with the count in tabular figures; side by side
 * under 1024 px, one over the other in the reviews' first column from
 * there. A reader hears "5 üzerinden 4,6 (28 değerlendirme)" and each row
 * whole; the marks are for the eye. All the shop's approved reviews, not
 * the three quoted beside it.
 */
export function RatingSummary({ summary, t }: { summary: ShopRatingView; t: Translate }) {
  const filled = Math.round(Number(summary.average.replace(",", ".")))
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-8 gap-y-6 sm:gap-x-10 lg:grid-cols-1">
      <div className="flex flex-col gap-2">
        <p className="sr-only">{summary.label}</p>
        <p aria-hidden="true" className="tabular font-display text-price-hero leading-none">
          {summary.average}
        </p>
        <p aria-hidden="true" className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, star) => (
            <Star
              key={star}
              strokeWidth={1.5}
              className={star < filled ? "size-4 fill-current" : "size-4 text-text-3"}
            />
          ))}
        </p>
        <p aria-hidden="true" className="text-sm text-text-3">
          {t("reviews.count", { count: summary.count })}
        </p>
      </div>
      <ul aria-label={t("reviews.distribution")} className="flex flex-col gap-1">
        {summary.distribution.map((bar) => (
          <li
            key={bar.stars}
            className="grid min-h-6 grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"
          >
            <span className="sr-only">{bar.label}</span>
            <span aria-hidden="true" className="tabular flex items-center gap-1 text-text-2">
              {bar.stars}
              <Star className="size-4 fill-current" strokeWidth={1.5} />
            </span>
            <span aria-hidden="true" className="h-2 bg-paper-3">
              <span className={cn("block h-full bg-text", fillFor(bar))} />
            </span>
            <span aria-hidden="true" className="tabular text-right text-text-2">
              {bar.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
