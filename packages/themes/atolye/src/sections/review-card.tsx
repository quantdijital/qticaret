import { BadgeCheck, Star } from "lucide-react"
import type { ReviewsProductImage } from "@qticaret/types/section-reviews"
import { ResponsiveImage } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"
import { Stars } from "../parts/Stars"
import { type Of } from "./plan"
import { quoteOf } from "./Reviews"

export type Review = Of<"reviews">["reviews"][number]

const ZOOM =
  "absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-(--dur-long) motion-safe:group-hover:scale-[1.03]"

/** Who wrote it, their first letter in a disc before, the verified mark, the date under. */
function Author({ review, t }: { review: Review; t: Translate }) {
  return (
    <span className="flex items-center gap-2.5 font-semibold text-text">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-3 text-sm font-bold text-text-2"
      >
        {review.author.trim().charAt(0).toLocaleUpperCase("tr-TR")}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          {review.author}
          {review.verified && (
            <BadgeCheck
              className="size-4 shrink-0 text-ok"
              role="img"
              aria-label={t("product.verified")}
              strokeWidth={2}
            />
          )}
        </span>
        <span className="text-xs font-normal text-text-2">{review.date}</span>
      </span>
    </span>
  )
}

function Quote({ review, t }: { review: Review; t: Translate }) {
  return (
    <>
      <Stars rating={review.rating} label={t("reviews.stars", { rating: review.rating })} />
      <blockquote className="flex-1 text-md leading-relaxed font-semibold">
        <p>“{quoteOf(review.body)}”</p>
      </blockquote>
    </>
  )
}

/**
 * `cover` (adr/0077 §10 Ek): a short picture across the card's top (the
 * customer's photo, else the product's) with the product's name on it as
 * its link, then the stars, the quote and who, in a disc with the date.
 */
function CoverCard({ review, sizes, t }: { review: Review; sizes: string; t: Translate }) {
  const product = review.product
  const image = review.photos?.[0]?.image ?? product?.image ?? null
  const picture = image && (
    <span className="relative block aspect-[2/1] overflow-hidden bg-media">
      <ResponsiveImage image={image} sizes={sizes} className={ZOOM} />
      {product && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent px-4 pt-10 pb-3 text-start text-sm leading-snug font-semibold text-white">
          <span className="line-clamp-2">{product.label}</span>
        </span>
      )}
    </span>
  )
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-tile border border-rule bg-paper">
      {picture &&
        (product ? (
          <a
            href={product.path}
            className="group block text-inherit no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
            aria-label={`${t("reviews.about")}: ${product.label}`}
          >
            {picture}
          </a>
        ) : (
          picture
        ))}
      <div className="flex flex-1 flex-col gap-3 p-5 lg:p-6">
        {!picture && product && (
          <a href={product.path} className="gf-link line-clamp-2 self-start text-sm text-text-2">
            {product.label}
          </a>
        )}
        <Quote review={review} t={t} />
        <footer className="pt-2 text-sm">
          <Author review={review} t={t} />
        </footer>
      </div>
    </article>
  )
}

/**
 * `thumb` (adr/0077 §10 Ek): today's card (the customer's photo on top when
 * there is one), its foot the author in a disc and, under a rule, the
 * product as a small square picture beside its name, both one link.
 */
function ThumbCard({ review, sizes, t }: { review: Review; sizes: string; t: Translate }) {
  const photo = review.photos?.[0] ?? null
  const product = review.product
  return (
    <article className="flex h-full flex-col gap-3 rounded-tile border border-rule bg-paper p-5 lg:p-6">
      {photo && (
        <span className="relative -mx-2 -mt-2 block aspect-[4/3] overflow-hidden rounded-media bg-media lg:-mx-3 lg:-mt-3">
          <ResponsiveImage
            image={photo.image}
            sizes={sizes}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </span>
      )}
      <Quote review={review} t={t} />
      <footer className="flex flex-col gap-3 pt-2 text-sm">
        <Author review={review} t={t} />
        {product && (
          <a
            href={product.path}
            className="group flex items-center gap-3 border-t border-rule pt-3 text-text-2 no-underline hover:text-text"
            aria-label={`${t("reviews.about")}: ${product.label}`}
          >
            {product.image && (
              <span className="relative block size-12 shrink-0 overflow-hidden rounded-media bg-media">
                <ResponsiveImage image={product.image} sizes="48px" className={ZOOM} />
              </span>
            )}
            <span className="line-clamp-2 font-semibold">{product.label}</span>
          </a>
        )}
      </footer>
    </article>
  )
}

/** One review as a card: its customer's first photo when there is one, the stars, the quote, who. */
function PlainCard({ review, sizes, t }: { review: Review; sizes: string; t: Translate }) {
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
      <Quote review={review} t={t} />
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
 * `compact` (owner 2026-11-28): no taller than today's card. A short
 * picture of the product across its top, then its name and one star with
 * the score in a row (picture and name one link), the quote in three
 * lines at most, who and when under a rule.
 */
function CompactCard({ review, sizes, t }: { review: Review; sizes: string; t: Translate }) {
  const product = review.product
  const score = review.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })
  // One star and the score: on the picture's corner, else before the name
  const rating = (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-sm font-semibold text-text shadow-sm backdrop-blur-sm"
      role="img"
      aria-label={t("reviews.stars", { rating: review.rating })}
    >
      <Star className="size-4 fill-star text-star" aria-hidden="true" strokeWidth={1.5} />
      {score}
    </span>
  )
  const picture = product?.image ?? null
  const head = (
    <>
      {picture && (
        <span className="relative block aspect-[5/2] overflow-hidden bg-media">
          <ResponsiveImage image={picture} sizes={sizes} className={ZOOM} />
          <span className="absolute top-2.5 right-2.5">{rating}</span>
        </span>
      )}
      <span className="flex items-start gap-2 px-4 pt-3 lg:px-5">
        {!picture && rating}
        {product && (
          <span className="line-clamp-2 min-w-0 text-sm leading-snug font-semibold text-text">
            {product.label}
          </span>
        )}
      </span>
    </>
  )
  // A breath of the shop's colour (owner 2026-11-28): the ground, its rule and the quote mark
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-tile bg-[color-mix(in_oklab,var(--color-signal)_9%,var(--color-paper))]">
      {product ? (
        <a
          href={product.path}
          className="group block no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
          aria-label={`${t("reviews.about")}: ${product.label}`}
        >
          {head}
        </a>
      ) : (
        <span className="block">{head}</span>
      )}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-4 lg:px-5 lg:pb-5">
        <blockquote className="flex-1 text-sm leading-relaxed text-text-2">
          <p className="line-clamp-3">
            <span
              aria-hidden="true"
              className="me-0.5 font-display text-lg leading-none text-signal"
            >
              “
            </span>
            {quoteOf(review.body)}”
          </p>
        </blockquote>
        <footer className="flex items-center gap-1.5 border-t border-[color-mix(in_oklab,var(--color-signal)_18%,var(--color-rule))] pt-3 text-xs text-text-2">
          <span className="font-semibold text-text">{review.author}</span>
          {review.verified && (
            <BadgeCheck
              className="size-3.5 shrink-0 text-ok"
              role="img"
              aria-label={t("product.verified")}
              strokeWidth={2}
            />
          )}
          <span aria-hidden="true">·</span>
          <span>{review.date}</span>
        </footer>
      </div>
    </article>
  )
}

/** The card the carousel's `product_image` asks for; `none` (or absent) is today's. */
export function ReviewCard(props: {
  review: Review
  sizes: string
  t: Translate
  productImage: ReviewsProductImage
}) {
  if (props.productImage === "compact") {
    return <CompactCard {...props} />
  }
  if (props.productImage === "cover") {
    return <CoverCard {...props} />
  }
  return props.productImage === "thumb" ? <ThumbCard {...props} /> : <PlainCard {...props} />
}
