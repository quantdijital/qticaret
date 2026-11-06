import { ChevronRight, Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { GoogleReviewRow } from "@/features/reviews/api/google-reviews"
import { formatDate, formatDateTime } from "@/lib/format"

const G = "reviews.google"

export function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation()
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={t("reviews.stars", { rating })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={
            star <= rating ? "size-4 fill-warning text-warning" : "size-4 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  )
}

/** The reply's badge: answered, waiting for Google's moderation, or refused there. */
export function ReplyBadge({ review }: { review: GoogleReviewRow }) {
  const { t } = useTranslation()
  if (!review.replied) {
    return null
  }
  if (review.reply_state === "pending") {
    return <StatusBadge tone="info">{t(`${G}.replyPending`)}</StatusBadge>
  }
  if (review.reply_state === "rejected") {
    return <StatusBadge tone="danger">{t(`${G}.replyRejected`)}</StatusBadge>
  }
  return <StatusBadge tone="neutral">{t(`${G}.replied`)}</StatusBadge>
}

/** Why, by whom and when a review was taken off the storefront. */
export function HiddenLine({ review }: { review: GoogleReviewRow }) {
  const { t } = useTranslation()
  if (!review.hidden || !review.hidden_reason) {
    return null
  }
  const who = [review.hidden_by, review.hidden_at ? formatDateTime(review.hidden_at) : null]
    .filter(Boolean)
    .join(", ")
  return (
    <p className="text-[13px] text-warning-text">
      {t(`${G}.hiddenWhy`, { reason: t(`${G}.reasons.${review.hidden_reason}`) })}
      {who ? ` · ${who}` : ""}
    </p>
  )
}

/**
 * One Google review as Google gives it, one row: the stars, whether the
 * shop replied (or Google still moderates the reply), whether it is off
 * the storefront and why. The whole row opens the review's dialog: the
 * reply and the storefront in one place (docs/18, edit patterns).
 */
export function GoogleReviewItem({
  review,
  onOpen,
}: {
  review: GoogleReviewRow
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const author = review.author ?? t(`${G}.anonymous`)
  return (
    <li>
      <button
        type="button"
        aria-label={t(`${G}.open`, { author })}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
        onClick={onOpen}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <ReplyBadge review={review} />
            {review.hidden ? (
              <StatusBadge tone="warning">{t(`${G}.hiddenBadge`)}</StatusBadge>
            ) : null}
          </span>
          {review.comment ? (
            <span className="line-clamp-3 text-sm whitespace-pre-wrap">{review.comment}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t(`${G}.noText`)}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {author} · {formatDate(review.created_at)}
          </span>
          <HiddenLine review={review} />
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}
