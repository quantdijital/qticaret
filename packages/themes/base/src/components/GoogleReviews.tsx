import { Star } from "lucide-react"
import type { GoogleReviewsView, Translate } from "@qticaret/ui"

/**
 * The shop's Google reviews, plain (adr/0058): Google's average and count,
 * the newest reviews with the shop's reply, a link out to read them all on
 * Google. Text only, never structured data.
 */
export function GoogleReviews({ google, t }: { google: GoogleReviewsView; t: Translate }) {
  return (
    <section aria-labelledby="google-yorumlari" className="flex flex-col gap-4">
      <h2 id="google-yorumlari" className="text-2xl">
        {t("reviews.google_title")}
      </h2>
      <p className="text-muted-foreground">{google.label}</p>
      {google.reviews.length > 0 && (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {google.reviews.map((review, index) => (
            <li key={String(index)} className="flex flex-col gap-1 p-5 text-sm">
              <span className="flex gap-0.5" role="img" aria-label={review.ratingLabel}>
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
              {review.text && <p>{review.text}</p>}
              <p className="text-xs text-muted-foreground">
                {review.author} · <time dateTime={review.date.dateTime}>{review.date.label}</time>
              </p>
              {review.reply && (
                <p className="mt-2 rounded-xl bg-muted p-3">
                  <span className="font-semibold">{t("reviews.google_reply")}: </span>
                  {review.reply.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        {t("reviews.google_source")}
        {google.allUrl && (
          <>
            {" "}
            <a
              href={google.allUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline"
            >
              {t("reviews.google_all")}
              <span className="sr-only"> {t("reviews.google_new_tab")}</span>
            </a>
          </>
        )}
      </p>
    </section>
  )
}
