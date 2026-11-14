import { BadgeCheck, Star, X } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ReviewFilterView, ReviewsPageView, Translate } from "@qticaret/ui"
import { Pager } from "../listing/Pager"
import { Container } from "../parts/Container"
import { ReviewReply } from "../parts/ReviewReply"
import { Stars } from "../parts/Stars"
import { Trail } from "../parts/Trail"
import { Summary } from "../sections/Reviews"
import { GoogleReviews } from "./GoogleReviews"

type Review = ReviewsPageView["reviews"][number]

/** The product a review is about, at the card's foot: its picture and its name, one link. */
function Product({ product, t }: { product: NonNullable<Review["product"]>; t: Translate }) {
  return (
    <a
      href={product.path}
      className="group flex min-h-14 items-center gap-3 border-t border-rule pt-3 no-underline"
    >
      <span className="relative size-12 shrink-0 overflow-hidden rounded-inner bg-paper-3">
        {product.image && (
          <ResponsiveImage
            image={{ ...product.image, alt: "" }}
            sizes="48px"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-text-3">{t("reviews.about")}</span>
        <span className="line-clamp-2 text-sm leading-snug font-semibold underline-offset-4 group-hover:underline">
          {product.label}
        </span>
      </span>
    </a>
  )
}

/**
 * One review whole: the stars, its title, the text, the customer's
 * photos, who and when, the shop's reply, the product.
 */
function Card({ review, t }: { review: Review; t: Translate }) {
  const photos = review.photos ?? []
  return (
    <li className="mb-(--gap-columns) flex min-w-0 break-inside-avoid flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6">
      <Stars rating={review.rating} label={t("reviews.stars", { rating: review.rating })} />
      {review.title && <h2 className="text-md tracking-[-0.01em]">{review.title}</h2>}
      <p className="text-md leading-relaxed break-words text-text-2">{review.body}</p>
      {photos.length > 0 && (
        <ul aria-label={t("reviews.photos")} className="flex flex-wrap gap-2">
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
                    alt: t("reviews.photo_alt", { author: review.author, n: index + 1 }),
                  }}
                  sizes="80px"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
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
        <span className="text-text-3">{review.date}</span>
      </p>
      {review.reply && <ReviewReply reply={review.reply} label={t("reviews.shop_reply")} />}
      {review.product && <Product product={review.product} t={t} />}
    </li>
  )
}

/**
 * The shop's approved reviews across its products (`/yorumlar`): from
 * 1024 px the shop-wide summary stays in a column on the left (the
 * average set large, the stars, the count, the spread), the reviews in
 * two columns on the right, each card as tall as its own words (newest
 * first down each column), whole with its photos and the product it is
 * about; then the pages; then, on the first unfiltered page, the shop's
 * Google reviews in a section of their own (adr/0058). With the star
 * filter (adr/0037 Ek 2026-11-05) the summary's bars are its links, and
 * the stars shown stand above the reviews as a dark pill that takes them
 * off. Nothing is written for the shop.
 */
export function ReviewsPage({ view, t }: { view: ReviewsPageView; t: Translate }) {
  const summary = view.summary ?? null
  const filter = view.filter ?? null
  const shown = filter && filter.active !== null ? filter : null
  return (
    <Container className="flex flex-col gap-8 pt-6 lg:gap-10 lg:pt-10">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <h1>{view.title}</h1>
      <div className="grid gap-(--gap-columns) lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-40">
            {summary ? (
              <Summary summary={summary} t={t} filter={filter} />
            ) : (
              view.average !== null && (
                <p className="rounded-tile bg-paper-2 p-6 text-text-2">
                  {t("reviews.summary", { average: view.average, count: view.count })}
                </p>
              )
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:col-span-8">
          {shown && <ActiveFilter filter={shown} t={t} />}
          {view.reviews.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-tile bg-paper-2 p-8 text-center text-text-2">
              <p>{t(shown ? "reviews.filter_empty" : "product.no_reviews")}</p>
              {shown && (
                <a href={shown.clearPath} rel="nofollow" className="gf-btn">
                  {t("reviews.filter_all")}
                </a>
              )}
            </div>
          ) : (
            <ul className="min-w-0 gap-(--gap-columns) md:columns-2">
              {view.reviews.map((review, index) => (
                <Card
                  key={`${review.author}:${review.date}:${String(index)}`}
                  review={review}
                  t={t}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <Pager pagination={view.pagination} t={t} />
      {view.google && <GoogleReviews google={view.google} t={t} />}
    </Container>
  )
}

/**
 * The stars shown now, as the listing's open filters are (design.md §
 * Liste sayfası): a dark pill that takes the filter off, and the way back
 * to every review beside it.
 */
function ActiveFilter({ filter, t }: { filter: ReviewFilterView; t: Translate }) {
  const label = filter.activeLabel ?? ""
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-text-2">{t("reviews.filter_shown")}</span>
      <a
        href={filter.clearPath}
        rel="nofollow"
        aria-label={t("reviews.filter_clear", { label })}
        className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-mark pr-3 pl-4 text-sm font-semibold whitespace-nowrap text-mark-ink no-underline transition-colors duration-(--dur-micro) hover:bg-mark-deep active:translate-y-px"
      >
        <Star className="size-4 fill-current" aria-hidden="true" strokeWidth={1.5} />
        {label}
        <X className="size-4" aria-hidden="true" strokeWidth={2.25} />
      </a>
      <a href={filter.clearPath} rel="nofollow" className="gf-link px-2 text-sm">
        {t("reviews.filter_all")}
      </a>
    </div>
  )
}
