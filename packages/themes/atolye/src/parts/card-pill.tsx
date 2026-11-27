import { Clock, Star } from "lucide-react"
import type { ProductCardView } from "@qticaret/ui"

/**
 * A compact card's stars and length (`density: compact`, sahip 2026-11-26),
 * shared by its rows under the photo (`card-compact.tsx`) and its pill on
 * the photo (`CompactPill`). `plain`: in the pill, in the pill's own ink.
 */

/** A dated card's length while the shop shows it; none otherwise. */
export const durationOf = (product: ProductCardView): string | undefined =>
  product.look?.duration ? product.booking?.duration : undefined

/** "★ 4,8 (12)" for the eye, the rating's whole sentence for a screen reader. */
export function RatingWords({
  product,
  plain = false,
}: {
  product: ProductCardView
  plain?: boolean
}) {
  const rating = product.rating
  if (!rating) {
    return null
  }
  return (
    <span className="flex items-center gap-1">
      <Star className="size-3.5 fill-star text-star" aria-hidden="true" strokeWidth={1.5} />
      <span aria-hidden="true" className="tabular">
        <span className={plain ? undefined : "font-semibold text-text"}>{rating.average}</span> (
        {rating.count})
      </span>
      <span className="sr-only">{rating.label}</span>
    </span>
  )
}

/** "5 gün • 4 gece" after a clock. */
export function DurationWords({ duration, plain = false }: { duration: string; plain?: boolean }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <Clock
        className={plain ? "size-3.5 shrink-0" : "size-3.5 shrink-0 text-text-3"}
        aria-hidden="true"
        strokeWidth={1.75}
      />
      <span>{duration}</span>
    </span>
  )
}

/**
 * The pill on a compact card's photo when its words stand over it (the
 * tour sites' trust badge): "★ 4,8 (12) · 5 gün • 4 gece", either alone
 * when the other is missing; nothing without both. Dark glass on the
 * split card, as its stars' pill.
 */
export function CompactPill({ product }: { product: ProductCardView }) {
  const duration = durationOf(product)
  if (!product.rating && !duration) {
    return null
  }
  return (
    <li
      className={
        product.look?.split
          ? "gf-card-pill-dark flex items-center gap-1.5 rounded-pill px-2 py-1"
          : "flex items-center gap-1.5 rounded-pill bg-field px-2 py-1 text-text"
      }
    >
      <RatingWords product={product} plain />
      {product.rating && duration && <span aria-hidden="true">·</span>}
      {duration && <DurationWords duration={duration} plain />}
    </li>
  )
}
