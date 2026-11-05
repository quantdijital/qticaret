import { Star } from "lucide-react"
import type { RatingBarView, ReviewPhotoView, ShopRatingView, Translate } from "@qticaret/ui"
import { ResponsiveImage } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { fillOf } from "../cart/FreeShippingBar"

/**
 * The stars' spread, 5 to 1 (adr/0046 Ek 2026-11-04): a row per number of
 * stars, its bar's width a class in 5% steps (the CSP refuses inline
 * style), its count beside it; each row read out whole.
 */
export function RatingBars({
  bars,
  label,
  starsLabel,
}: {
  bars: RatingBarView[]
  label: string
  /** "{stars} yıldız", by number of stars. */
  starsLabel: Record<number, string>
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5 text-xs">
      {bars.map((bar) => (
        <li key={bar.stars} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-3">
          <span className="sr-only">{bar.label}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            {starsLabel[bar.stars]}
          </span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full bg-foreground", fillOf(bar.percent))} />
          </span>
          <span aria-hidden="true" className="tabular text-right text-muted-foreground">
            {bar.count}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The shop's reviews in short (adr/0046 Ek 2026-11-05): the average large
 * with its stars and count, the spread beside it; read out as one line.
 */
export function RatingSummary({ summary, t }: { summary: ShopRatingView; t: Translate }) {
  const filled = Math.round(Number(summary.average.replace(",", ".")))
  return (
    <div className="grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10">
      <div className="flex flex-col gap-1">
        <p className="sr-only">{summary.label}</p>
        <p aria-hidden="true" className="tabular text-5xl font-semibold leading-none">
          {summary.average}
        </p>
        <p aria-hidden="true" className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={
                star <= filled ? "size-4 fill-current text-primary" : "size-4 text-muted-foreground"
              }
            />
          ))}
        </p>
        <p aria-hidden="true" className="text-sm text-muted-foreground">
          {t("reviews.count", { count: summary.count })}
        </p>
      </div>
      <RatingBars
        bars={summary.distribution}
        label={t("reviews.distribution")}
        starsLabel={Object.fromEntries(
          [5, 4, 3, 2, 1].map((stars) => [stars, t("reviews.bar_stars", { stars })])
        )}
      />
    </div>
  )
}

/** A review's photos as small squares, each opening the full picture. */
export function ReviewPhotos({ photos, label }: { photos: ReviewPhotoView[]; label: string }) {
  if (photos.length === 0) {
    return null
  }
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2 pt-1">
      {photos.map((photo) => (
        <li key={photo.image.src}>
          <a
            href={photo.image.src}
            target="_blank"
            rel="noopener"
            className="block size-20 overflow-hidden rounded-lg border bg-muted"
          >
            <ResponsiveImage image={photo.image} sizes="80px" className="size-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  )
}
