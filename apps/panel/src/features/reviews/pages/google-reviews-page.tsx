import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import {
  GOOGLE_REVIEW_PAGE_SIZE,
  googleReviewItemsQuery,
  googleReviewsQuery,
  useHideGoogleReview,
} from "@/features/reviews/api/google-reviews"
import { GoogleConnectionCard } from "@/features/reviews/components/google-connection-card"
import { GoogleReviewItem } from "@/features/reviews/components/google-review-item"
import { ReviewsNav } from "@/features/reviews/components/reviews-nav"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/reviews/google")
const G = "reviews.google"

/**
 * Yorumlar > Google yorumları (adr/0058): the shop's Google reviews from
 * its Business Profile, read every day and shown on the storefront's
 * reviews page beside its own. Google's reviews are not moderated here
 * (they are Google's); one review at a time can be kept off the
 * storefront, only for personal data, abuse or being off topic, never for
 * its stars (adr/0058 Ek). Without the platform's Google client the page
 * says so in a line (docs/06 principle 10: nothing to act on).
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
                    onHide={(reason) => {
                      hide.mutate(
                        { id: review.id, hidden: true, reason },
                        {
                          onSuccess: () => toast.success(t(`${G}.hiddenDone`)),
                          onError: (failure) => toast.error(errorText(t, failure)),
                        }
                      )
                    }}
                    onRestore={() => {
                      hide.mutate(
                        { id: review.id, hidden: false },
                        {
                          onSuccess: () => toast.success(t(`${G}.shownDone`)),
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
