import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  GOOGLE_REVIEW_PAGE_SIZE,
  googleReviewItemsQuery,
  googleReviewsQuery,
  useHideGoogleReview,
} from "@/features/reviews/api/google-reviews"
import type { GoogleReviewRow } from "@/features/reviews/api/google-reviews"
import { GoogleConnectionCard } from "@/features/reviews/components/google-connection-card"
import { ReviewsNav } from "@/features/reviews/components/reviews-nav"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const route = getRouteApi("/_auth/reviews/google")
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

/** One Google review as Google gives it, with "Vitrinde göster" beside it. */
function GoogleReviewItem({
  review,
  busy,
  onToggle,
}: {
  review: GoogleReviewRow
  busy: boolean
  onToggle: (shown: boolean) => void
}) {
  const { t } = useTranslation()
  const author = review.author ?? t(`${G}.anonymous`)
  const id = `google-review-${review.id}`
  return (
    <li className="flex gap-4 px-5 py-4">
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
      </div>
      <div className="flex shrink-0 items-start gap-2 pt-0.5">
        <label htmlFor={id} className="text-[13px] text-muted-foreground">
          {t(`${G}.shown`)}
        </label>
        <Switch
          id={id}
          checked={!review.hidden}
          disabled={busy}
          aria-label={t(`${G}.showReview`, { author })}
          onCheckedChange={onToggle}
        />
      </div>
    </li>
  )
}

/**
 * Yorumlar > Google yorumları (adr/0058): the shop's Google reviews from
 * its Business Profile, read every day and shown on the storefront's
 * reviews page beside its own. Google's reviews are not moderated here
 * (they are Google's); a review can only be kept off the storefront.
 * Without the platform's Google client the page says so in a line
 * (docs/06 principle 10: nothing to act on).
 */
export function GoogleReviewsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const page = (search.page ?? 1) - 1
  const status = useQuery(googleReviewsQuery())
  const google = status.data?.google_reviews
  const chosen = google?.location !== null && google?.location !== undefined
  const list = useQuery(googleReviewItemsQuery(page, chosen))
  const hide = useHideGoogleReview()
  const rows = list.data?.reviews ?? []
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("reviews.title")} description={t(`${G}.pageDescription`)} />
      <ReviewsNav />
      {google?.configured === false ? (
        <p className="text-sm text-muted-foreground">{t(`${G}.notConfigured`)}</p>
      ) : (
        <GoogleConnectionCard status={google} />
      )}
      {chosen ? (
        <SectionCard title={t(`${G}.listTitle`)} description={t(`${G}.listDescription`)} flush>
          {list.isError ? (
            <ErrorState
              text={errorText(t, list.error)}
              onRetry={() => {
                void list.refetch()
              }}
            />
          ) : !list.data ? (
            <Skeleton className="m-5 h-32" />
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t(`${G}.empty`)}</p>
          ) : (
            <>
              <ul className="divide-y border-t">
                {rows.map((review) => (
                  <GoogleReviewItem
                    key={review.id}
                    review={review}
                    busy={hide.isPending}
                    onToggle={(shown) => {
                      hide.mutate(
                        { id: review.id, hidden: !shown },
                        {
                          onSuccess: () =>
                            toast.success(t(shown ? `${G}.shownDone` : `${G}.hiddenDone`)),
                          onError: (failure) => toast.error(errorText(t, failure)),
                        }
                      )
                    }}
                  />
                ))}
              </ul>
              {list.data.count > GOOGLE_REVIEW_PAGE_SIZE ? (
                <Pagination
                  page={page}
                  pageSize={GOOGLE_REVIEW_PAGE_SIZE}
                  count={list.data.count}
                  onPageChange={(next) => {
                    void navigate({
                      to: "/reviews/google",
                      search: { page: next > 0 ? next + 1 : undefined },
                      replace: true,
                    })
                  }}
                />
              ) : null}
            </>
          )}
        </SectionCard>
      ) : null}
    </div>
  )
}
