import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { REVIEW_PAGE_SIZE, moderateReviews, reviewsQuery } from "@/features/reviews/api/reviews"
import type { ReviewRow, ReviewTab } from "@/features/reviews/api/reviews"
import { ReviewDialog } from "@/features/reviews/components/review-dialog"
import { ReviewItem } from "@/features/reviews/components/review-item"
import { ReviewsNav } from "@/features/reviews/components/reviews-nav"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/reviews/")
const R = "reviews"

/**
 * Yorumlar (F10.6, KK1): customers' reviews of products they received,
 * shown on the storefront only once the shop approves them. Waiting ones
 * first and oldest first; many at once with the boxes. An approved one
 * opens its dialog, where the shop replies under it in public; "Yanıtsız"
 * lists the approved ones still without a reply.
 */
export function ReviewsPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const search = route.useSearch()
  const navigate = useNavigate()
  const tab: ReviewTab = search.status ?? "pending"
  const page = (search.page ?? 1) - 1
  const list = useQuery(reviewsQuery(tab, page))
  /** The picked reviews as shown, each with the version the decision is on. */
  const seen = (ids: ReadonlySet<string>) =>
    (list.data?.reviews ?? [])
      .filter((review) => ids.has(review.id))
      .map(({ id, updated_at }) => ({ id, updated_at }))
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [opened, setOpened] = useState<ReviewRow | null>(null)
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
  const setSearch = (next: { status?: ReviewTab; page?: number }) => {
    const nextTab = next.status ?? tab
    setSelected(new Set())
    void navigate({
      to: "/reviews",
      search: {
        status: nextTab === "pending" ? undefined : nextTab,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const rows = list.data?.reviews ?? []
  // The open review as the list reads it now; as opened once a reply took it off "Yanıtsız"
  const shown = opened ? (rows.find((review) => review.id === opened.id) ?? opened) : null
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${R}.title`)} description={t(`${R}.description`)} />
      <ReviewsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${R}.views`)}
          value={tab}
          onChange={(next) => {
            setSearch({ status: next, page: 1 })
          }}
          tabs={[
            { key: "pending", label: t(`${R}.tabs.pending`) },
            { key: "approved", label: t(`${R}.tabs.approved`) },
            { key: "unreplied", label: t(`${R}.tabs.unreplied`) },
            { key: "rejected", label: t(`${R}.tabs.rejected`) },
          ]}
        />
        {tab === "pending" && selected.size > 0 ? (
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
            {t(`${R}.empty.${tab}`)}
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
                  onOpen={
                    review.status === "approved"
                      ? () => {
                          setOpened(review)
                        }
                      : null
                  }
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
      {shown ? (
        <ReviewDialog
          key={shown.id}
          review={shown}
          onClose={() => {
            setOpened(null)
          }}
        />
      ) : null}
    </div>
  )
}
