import { Star } from "lucide-react"
import type { ReviewsPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { Pages } from "./components/Pages"
import { RatingSummary, ReviewPhotos } from "./components/ReviewExtras"

/** The shop's approved reviews, newest first, each with its product's link. */
export function ReviewsPage({ view, t }: { view: ReviewsPageView; t: Translate }) {
  return (
    <PageContainer className="flex flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-4xl">{view.title}</h1>
      {view.summary ? (
        <RatingSummary summary={view.summary} t={t} />
      ) : (
        view.average !== null && (
          <p className="text-muted-foreground">
            {t("reviews.summary", { average: view.average, count: view.count })}
          </p>
        )
      )}
      {view.reviews.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {t("product.no_reviews")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {view.reviews.map((review, index) => (
            <li key={String(index)} className="flex flex-col gap-1 p-5 text-sm">
              <span
                className="flex gap-0.5"
                role="img"
                aria-label={t("product.average", { value: review.rating })}
              >
                {[1, 2, 3, 4, 5].map((each) => (
                  <Star
                    key={each}
                    aria-hidden="true"
                    className={
                      each <= review.rating
                        ? "size-4 fill-foreground"
                        : "size-4 text-muted-foreground"
                    }
                  />
                ))}
              </span>
              {review.title && <p className="font-semibold">{review.title}</p>}
              <p>{review.body}</p>
              <ReviewPhotos photos={review.photos ?? []} label={t("reviews.photos")} />
              <p className="text-xs text-muted-foreground">
                {review.author} · {review.date}
                {review.verified && ` · ${t("product.verified")}`}
                {review.product && (
                  <>
                    {" · "}
                    <a href={review.product.path} className="font-medium text-foreground underline">
                      {review.product.label}
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pages pagination={view.pagination} t={t} />
    </PageContainer>
  )
}
