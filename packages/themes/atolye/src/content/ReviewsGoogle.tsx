import { ExternalLink } from "lucide-react"
import type { GoogleReviewsView, ReviewsPageItemView, Translate } from "@qticaret/ui"
import { GoogleMark } from "../parts/GoogleMark"
import { Stars } from "../parts/Stars"

// The Google parts of `/yorumlar` with Google's reviews mixed into the shop's (adr/0058 Ek 2026-11-27)

const FOOT = "flex min-h-14 items-center gap-3 border-t border-rule pt-3 no-underline"

/**
 * A Google review card's foot, where a shop review's product sits: Google's
 * mark in the product picture's square, "Google yorumu" and "Google'da
 * gör" out to the review itself on Google, in a new tab.
 */
export function GoogleFoot({
  google,
  t,
}: {
  google: NonNullable<ReviewsPageItemView["google"]>
  t: Translate
}) {
  const body = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-inner bg-paper-2">
        <GoogleMark className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-text-3">{t("reviews.google_review")}</span>
        {google.url && (
          <span className="flex items-center gap-1.5 text-sm leading-snug font-semibold transition-colors duration-(--dur-micro) group-hover:text-text-2">
            {t("reviews.google_view")}
            <ExternalLink className="size-3.5" aria-hidden="true" strokeWidth={2} />
          </span>
        )}
      </span>
    </>
  )
  return google.url ? (
    <a
      href={google.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${google.label} ${t("reviews.google_new_tab")}`}
      className={`group ${FOOT}`}
    >
      {body}
    </a>
  ) : (
    <div className={FOOT}>{body}</div>
  )
}

/**
 * Google's own figures beside the shop's, never added to them (adr/0058):
 * Google's mark, its average and stars, its count, and its pages to read
 * every review and to write one; a line saying where they come from.
 */
export function GoogleSummary({ google, t }: { google: GoogleReviewsView; t: Translate }) {
  return (
    <section
      aria-labelledby="google-puani"
      className="flex flex-col gap-4 rounded-tile border border-rule p-6 lg:p-8"
    >
      <h2 id="google-puani" className="flex items-center gap-2 text-md tracking-[-0.01em]">
        <GoogleMark className="size-5" />
        {t("reviews.google_title")}
      </h2>
      <p className="flex items-end gap-3">
        {google.average && (
          <span
            aria-hidden="true"
            className="tabular text-figure leading-none font-extrabold tracking-(--tracking-display)"
          >
            {google.average}
          </span>
        )}
        <span aria-hidden="true" className="flex flex-col gap-1 pb-1">
          {google.rating !== null && <Stars rating={google.rating} size="size-5" />}
          <span className="text-sm text-text-2">
            {t("reviews.google_count_short", { count: google.count })}
          </span>
        </span>
        <span className="sr-only">{google.label}</span>
      </p>
      {(google.allUrl ?? google.writeUrl) && (
        <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {google.allUrl && (
            <a href={google.allUrl} target="_blank" rel="noopener noreferrer" className="gf-link">
              {t("reviews.google_all")}
              <span className="sr-only"> {t("reviews.google_new_tab")}</span>
            </a>
          )}
          {google.writeUrl && (
            <a href={google.writeUrl} target="_blank" rel="noopener noreferrer" className="gf-link">
              {t("reviews.google_write")}
              <span className="sr-only"> {t("reviews.google_new_tab")}</span>
            </a>
          )}
        </p>
      )}
      <p className="text-xs text-text-3">{t("reviews.google_source_mixed")}</p>
    </section>
  )
}
