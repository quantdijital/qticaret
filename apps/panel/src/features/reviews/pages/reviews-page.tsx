import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Star } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { REVIEW_PAGE_SIZE, moderateReviews, reviewsQuery } from "@/features/reviews/api/reviews"
import type { ReviewRow, ReviewStatus } from "@/features/reviews/api/reviews"
import { ReviewPhotos } from "@/features/reviews/components/review-photos"
import { ReviewsNav } from "@/features/reviews/components/reviews-nav"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const route = getRouteApi("/_auth/reviews/")
const R = "reviews"

/** Five stars, the review's filled; read out as "5 üzerinden 4". */
function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={t(`${R}.stars`, { rating })}>
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

function ReviewItem({
  review,
  selected,
  onSelect,
  onModerate,
  busy,
}: {
  review: ReviewRow
  selected: boolean
  onSelect: (selected: boolean) => void
  onModerate: (status: "approved" | "rejected") => void
  busy: boolean
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
          {review.product.title ? (
            <Link
              to="/products/$id"
              params={{ id: review.product.id }}
              className="truncate text-sm font-medium hover:underline"
            >
              {review.product.title}
            </Link>
          ) : null}
        </div>
        {review.title ? <p className="text-sm font-medium">{review.title}</p> : null}
        <p className="text-sm whitespace-pre-wrap">{review.body}</p>
        <ReviewPhotos photos={review.photos} author={review.author_name} />
        <p className="text-xs text-muted-foreground">
          {review.author_name} · {formatDate(review.created_at)}
          {review.reject_reason ? ` · ${review.reject_reason}` : ""}
        </p>
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
      ) : null}
    </li>
  )
}

/**
 * Yorumlar (F10.6, KK1): customers' reviews of products they received,
 * shown on the storefront only once the shop approves them. Waiting ones
 * first and oldest first; many at once with the boxes.
 */
export function ReviewsPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status: ReviewStatus = search.status ?? "pending"
  const page = (search.page ?? 1) - 1
  const list = useQuery(reviewsQuery(status, page))
  /** The picked reviews as shown, each with the version the decision is on. */
  const seen = (ids: ReadonlySet<string>) =>
    (list.data?.reviews ?? [])
      .filter((review) => ids.has(review.id))
      .map(({ id, updated_at }) => ({ id, updated_at }))
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const moderate = useMutation({
    mutationFn: moderateReviews,
    onSuccess: async ({ moderated, changed }, { status: next }) => {
      if (moderated > 0) {
        toast.success(
          t(next === "approved" ? `${R}.approved` : `${R}.rejected`, { count: moderated })
        )
      }
      // Changed by its author while shown: left waiting, to be read again
      if (changed.length > 0) {
        toast.warning(t(`${R}.changed`, { count: changed.length }))
      }
      setSelected(new Set())
      await client.invalidateQueries({ queryKey: ["reviews"] })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const setSearch = (next: { status?: ReviewStatus; page?: number }) => {
    const nextStatus = next.status ?? status
    setSelected(new Set())
    void navigate({
      to: "/reviews",
      search: {
        status: nextStatus === "pending" ? undefined : nextStatus,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const rows = list.data?.reviews ?? []
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${R}.title`)} description={t(`${R}.description`)} />
      <ReviewsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${R}.views`)}
          value={status}
          onChange={(next) => {
            setSearch({ status: next, page: 1 })
          }}
          tabs={[
            { key: "pending", label: t(`${R}.tabs.pending`) },
            { key: "approved", label: t(`${R}.tabs.approved`) },
            { key: "rejected", label: t(`${R}.tabs.rejected`) },
          ]}
        />
        {status === "pending" && selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <span className="text-sm">{t(`${R}.selected`, { count: selected.size })}</span>
            <Button
              size="sm"
              disabled={moderate.isPending}
              onClick={() => {
                moderate.mutate({ reviews: seen(selected), status: "approved" })
              }}
            >
              {t(`${R}.approveSelected`)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={moderate.isPending}
              onClick={() => {
                moderate.mutate({ reviews: seen(selected), status: "rejected" })
              }}
            >
              {t(`${R}.rejectSelected`)}
            </Button>
          </div>
        ) : null}
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
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t(`${R}.empty.${status}`)}
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {rows.map((review) => (
                <ReviewItem
                  key={review.id}
                  review={review}
                  selected={selected.has(review.id)}
                  busy={moderate.isPending}
                  onSelect={(on) => {
                    setSelected((was) => {
                      const next = new Set(was)
                      if (on) {
                        next.add(review.id)
                      } else {
                        next.delete(review.id)
                      }
                      return next
                    })
                  }}
                  onModerate={(next) => {
                    moderate.mutate({
                      reviews: [{ id: review.id, updated_at: review.updated_at }],
                      status: next,
                    })
                  }}
                />
              ))}
            </ul>
            {list.data.count > REVIEW_PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={REVIEW_PAGE_SIZE}
                count={list.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
