import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { Stars } from "@/features/reviews/components/stars"
import { ReviewPhotos } from "@/features/reviews/components/review-photos"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const R = "reviews"

/** The review's words: its title, the text, who and when, the shop's reply in a line. */
function ReviewText({ review }: { review: ReviewRow }) {
  const { t } = useTranslation()
  return (
    <>
      {review.title ? <span className="block text-sm font-medium">{review.title}</span> : null}
      <span className="block text-sm whitespace-pre-wrap">{review.body}</span>
      <span className="block text-xs text-muted-foreground">
        {review.author_name} · {formatDate(review.created_at)}
        {review.reject_reason ? ` · ${review.reject_reason}` : ""}
      </span>
      {review.reply ? (
        <span className="line-clamp-2 block border-l-2 pl-3 text-[13px] text-muted-foreground">
          {t(`${R}.reply.preview`, { reply: review.reply })}
        </span>
      ) : null}
    </>
  )
}

/**
 * One customer review in the list: the stars, whether it carries a link or
 * the shop replied, the product, the text and photos. A waiting one is
 * approved or rejected in its row; an approved one opens its dialog from
 * its text, where the shop replies (docs/18, edit patterns), and is hidden
 * from its row; a hidden one is shown again from its row.
 */
export function ReviewItem({
  review,
  selected,
  onSelect,
  onModerate,
  onOpen,
  busy,
  aside,
}: {
  review: ReviewRow
  selected: boolean
  onSelect: (selected: boolean) => void
  onModerate: (status: "approved" | "rejected") => void
  /** Opens the review's dialog; only an approved review has one. */
  onOpen: (() => void) | null
  busy: boolean
  /** Beside the product: its reviews summed up (Aşama 9), on the first row of each product. */
  aside?: ReactNode
}) {
  const { t } = useTranslation()
  const id = `review-${review.id}`
  return (
    <li className="flex gap-3 px-5 py-4">
      <Checkbox
        id={id}
        aria-label={t(`${R}.select`, { author: review.author_name })}
        checked={selected}
        onCheckedChange={(checked) => {
          onSelect(checked === true)
        }}
        className="mt-1"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Stars rating={review.rating} />
          {review.has_link ? <StatusBadge tone="warning">{t(`${R}.hasLink`)}</StatusBadge> : null}
          {review.reply ? <StatusBadge tone="neutral">{t(`${R}.replied`)}</StatusBadge> : null}
          {review.product.title ? (
            <Link
              to="/products/$id"
              params={{ id: review.product.id }}
              className="truncate text-sm font-medium hover:underline"
            >
              {review.product.title}
            </Link>
          ) : null}
          {aside}
        </div>
        {onOpen ? (
          <button
            type="button"
            aria-label={t(`${R}.open`, { author: review.author_name })}
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50"
            onClick={onOpen}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <ReviewText review={review} />
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <ReviewText review={review} />
        )}
        <ReviewPhotos photos={review.photos} author={review.author_name} />
      </div>
      {review.status === "pending" ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              onModerate("approved")
            }}
          >
            {t(`${R}.approve`)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onModerate("rejected")
            }}
          >
            {t(`${R}.reject`)}
          </Button>
        </div>
      ) : (
        // A customer's review is never edited or deleted by the shop: it is hidden or shown
        // again (adr/0037 §4 Ek 2026-11-27)
        <div className="flex shrink-0 sm:items-start">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={t(review.status === "approved" ? `${R}.hideFor` : `${R}.showFor`, {
              author: review.author_name,
            })}
            onClick={() => {
              onModerate(review.status === "approved" ? "rejected" : "approved")
            }}
          >
            {t(review.status === "approved" ? `${R}.hide` : `${R}.show`)}
          </Button>
        </div>
      )}
    </li>
  )
}
