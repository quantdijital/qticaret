"use client"

import { BadgeCheck, ChevronDown, Star, X } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { RatingBarView, ReviewView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { fillOf } from "../parts/FreeShippingMeter"
import { ReviewReply } from "../parts/ReviewReply"
import { Stars } from "../parts/Stars"
import type { ReviewListWords } from "./words"

/** Reviews shown before "Daha fazla değerlendirme göster", and how many each press adds. */
export const PAGE = 5

type Order = "newest" | "highest" | "lowest"

const BAR = "grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"

function Bar({ bar, words }: { bar: RatingBarView; words: ReviewListWords }) {
  return (
    <>
      <span aria-hidden="true">{words.barStars.replace("{stars}", String(bar.stars))}</span>
      <span aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-paper-3">
        <span className={`block h-full rounded-pill bg-star ${fillOf(bar.percent)}`} />
      </span>
      <span aria-hidden="true" className="tabular text-right">
        {bar.count}
      </span>
      <span className="sr-only">{bar.label}</span>
    </>
  )
}

function Review({ review, words }: { review: ReviewView; words: ReviewListWords }) {
  const photos = review.photos ?? []
  return (
    <>
      <Stars rating={review.rating} label={words.stars[review.rating] ?? ""} />
      {review.title && <h3 className="text-md tracking-[-0.01em]">{review.title}</h3>}
      <p className="max-w-[46rem] text-md leading-relaxed break-words text-text-2">{review.body}</p>
      {photos.length > 0 && (
        <ul aria-label={words.photos} className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <li key={photo.image.src}>
              <a
                href={photo.image.src}
                target="_blank"
                rel="noopener"
                className="relative block size-20 overflow-hidden rounded-inner bg-paper-2"
              >
                <ResponsiveImage
                  image={{
                    ...photo.image,
                    alt: words.photoAlt
                      .replace("{author}", review.author)
                      .replace("{n}", String(index + 1)),
                  }}
                  sizes="80px"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{review.author}</span>
        {review.verified && (
          <span className="flex items-center gap-1.5 text-ok">
            <BadgeCheck className="size-4" aria-hidden="true" strokeWidth={2} />
            {words.verified}
          </span>
        )}
        <span className="text-text-3">{review.date}</span>
      </p>
      {review.reply && (
        <div className="max-w-[46rem]">
          <ReviewReply reply={review.reply} label={words.reply} />
        </div>
      )}
    </>
  )
}

/**
 * The product's reviews (owner 2026-11-06: "değerlendirmeleri gösterme
 * alanını beğenmedik"): from 1024 px a summary panel on the left, sticky
 * (the average set large, the stars, the count, the 5→1 spread, then
 * `action`: "Değerlendirme yaz" or the way to sign in), the reviews on
 * the right as one ruled list (the stars and the date, the title, the
 * text whole, the photos, the name with its verified mark, the shop's
 * reply under it), five at
 * first and five more a press. With every review on the page
 * (`complete`) the spread's bars filter by stars and the list sorts
 * newest, highest or lowest; with only the newest of many they stay a
 * picture of the spread, the order the newest. Without the script every
 * review shows.
 */
export function ReviewList({
  average,
  averageLabel,
  countText,
  bars,
  items,
  complete,
  action,
  words,
}: {
  /** "4,9". */
  average: string
  /** "Ortalama puan: 5 üzerinden 4,9", for a screen reader. */
  averageLabel: string
  /** "9 değerlendirme". */
  countText: string
  bars: RatingBarView[]
  items: ReviewView[]
  complete: boolean
  action: ReactNode
  words: ReviewListWords
}) {
  const [stars, setStars] = useState<number | null>(null)
  const [order, setOrder] = useState<Order>("newest")
  const [shown, setShown] = useState(PAGE)
  const filters = complete && items.length > 1
  const picked = items
    .filter((review) => stars === null || review.rating === stars)
    // A stable sort: equal ratings keep the newest first
    .sort((a, b) =>
      order === "highest" ? b.rating - a.rating : order === "lowest" ? a.rating - b.rating : 0
    )
  const rest = picked.length - shown
  const choose = (next: number | null) => {
    setStars(next)
    setShown(PAGE)
  }
  const label = stars === null ? "" : words.barStars.replace("{stars}", String(stars))
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
      <div className="lg:col-span-4">
        <div className="flex flex-col gap-6 rounded-tile gf-box p-6 lg:sticky lg:top-(--gf-stick-top) lg:p-8">
          <p className="flex items-end gap-3">
            <span className="tabular text-figure leading-none font-extrabold tracking-(--tracking-display)">
              {average}
            </span>
            <span className="flex flex-col gap-1 pb-1">
              <Stars rating={Number(average.replace(",", "."))} size="size-5" />
              <span className="text-sm text-text-2">{countText}</span>
            </span>
            <span className="sr-only">{averageLabel}</span>
          </p>
          {bars.length > 0 && (
            <ul
              aria-label={filters ? words.filterLabel : words.distribution}
              className={filters ? "-mx-3 flex flex-col gap-0.5" : "flex flex-col gap-1.5"}
            >
              {bars.map((bar) => (
                <li key={bar.stars}>
                  {filters && bar.count > 0 ? (
                    <button
                      type="button"
                      aria-pressed={stars === bar.stars}
                      onClick={() => {
                        choose(stars === bar.stars ? null : bar.stars)
                      }}
                      className={cn(
                        BAR,
                        "min-h-11 w-full cursor-pointer rounded-inner px-3 text-left transition-colors duration-(--dur-micro) hover:bg-paper active:translate-y-px",
                        stars === bar.stars ? "bg-paper font-extrabold text-text" : "text-text-2"
                      )}
                    >
                      <Bar bar={bar} words={words} />
                    </button>
                  ) : (
                    <span
                      className={cn(BAR, filters ? "min-h-11 px-3 text-text-3" : "text-text-2")}
                    >
                      <Bar bar={bar} words={words} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {action}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2 lg:col-span-8">
        {(filters || stars !== null) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
            <div aria-live="polite" className="flex min-h-11 flex-wrap items-center gap-2">
              {stars !== null && (
                <>
                  <span className="text-sm text-text-2">{words.filterShown}</span>
                  <button
                    type="button"
                    aria-label={words.filterClear.replace("{label}", label)}
                    onClick={() => {
                      choose(null)
                    }}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill bg-mark pr-3 pl-4 text-sm font-semibold whitespace-nowrap text-mark-ink transition-colors duration-(--dur-micro) hover:bg-mark-deep active:translate-y-px"
                  >
                    <Star className="size-4 fill-current" aria-hidden="true" strokeWidth={1.5} />
                    {label}
                    <X className="size-4" aria-hidden="true" strokeWidth={2.25} />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="yorum-sirasi" className="text-text-2">
                {words.sort}
              </label>
              <span className="relative">
                <select
                  id="yorum-sirasi"
                  value={order}
                  onChange={(event) => {
                    setOrder(event.target.value as Order)
                    setShown(PAGE)
                  }}
                  className="min-h-11 cursor-pointer appearance-none rounded-button border border-edge bg-paper py-2 pr-10 pl-4 font-semibold"
                >
                  <option value="newest">{words.newest}</option>
                  <option value="highest">{words.highest}</option>
                  <option value="lowest">{words.lowest}</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                  strokeWidth={2}
                />
              </span>
            </div>
          </div>
        )}
        {picked.length === 0 ? (
          <p className="py-6 text-text-2">{words.filterEmpty}</p>
        ) : (
          <ul className="flex flex-col">
            {picked.map((review, index) => (
              <li
                key={`${review.author}:${review.date}:${String(items.indexOf(review))}`}
                data-later={index >= shown ? "" : undefined}
                className="gf-later flex flex-col gap-3 border-b border-rule py-6 first:pt-2 last:border-b-0"
              >
                <Review review={review} words={words} />
              </li>
            ))}
          </ul>
        )}
        {rest > 0 && (
          <button
            type="button"
            onClick={() => {
              setShown(shown + PAGE)
            }}
            className="gf-later-toggle gf-btn gf-btn--quiet gf-btn--small self-start"
          >
            {words.more}
            <ChevronDown className="size-4" aria-hidden="true" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}
