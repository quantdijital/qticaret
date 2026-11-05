import { Star } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import type { GoogleReviewRow, HideReason } from "@/features/reviews/api/google-reviews"
import { HideReviewDialog } from "@/features/reviews/components/hide-review-dialog"
import { formatDate, formatDateTime } from "@/lib/format"

const G = "reviews.google"

function Stars({ rating }: { rating: number }) {
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

/**
 * One Google review as Google gives it. Shown: "Vitrinden kaldır" asks
 * for one of the three reasons (adr/0058 Ek). Taken off: the reason, who
 * and when, and "Vitrine geri al".
 */
export function GoogleReviewItem({
  review,
  busy,
  onHide,
  onRestore,
}: {
  review: GoogleReviewRow
  busy: boolean
  onHide: (reason: HideReason) => void
  onRestore: () => void
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const author = review.author ?? t(`${G}.anonymous`)
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Stars rating={review.rating} />
          {review.replied ? <StatusBadge tone="neutral">{t(`${G}.replied`)}</StatusBadge> : null}
          {review.hidden ? <StatusBadge tone="warning">{t(`${G}.hiddenBadge`)}</StatusBadge> : null}
        </div>
        {review.comment ? (
          <p className="text-sm whitespace-pre-wrap">{review.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t(`${G}.noText`)}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {author} · {formatDate(review.created_at)}
        </p>
        {review.hidden && review.hidden_reason ? (
          <p className="text-[13px] text-warning-text">
            {t(`${G}.hiddenWhy`, { reason: t(`${G}.reasons.${review.hidden_reason}`) })}
            {review.hidden_by || review.hidden_at
              ? ` · ${[review.hidden_by, review.hidden_at ? formatDateTime(review.hidden_at) : null]
                  .filter(Boolean)
                  .join(", ")}`
              : ""}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start">
        {review.hidden ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onRestore}>
            {t(`${G}.restore`)}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={t(`${G}.hideFor`, { author })}
            onClick={() => {
              setAsking(true)
            }}
          >
            {t(`${G}.hide`)}
          </Button>
        )}
      </div>
      <HideReviewDialog
        author={author}
        open={asking}
        busy={busy}
        onOpenChange={setAsking}
        onConfirm={(reason) => {
          setAsking(false)
          onHide(reason)
        }}
      />
    </li>
  )
}
