import { ExternalLink } from "lucide-react"
import type { GoogleReviewView, GoogleReviewsView, Translate } from "@qticaret/ui"
import { Stars } from "../parts/Stars"

/** The reviewer as Google shows them: their photo, else the first letter of the name on a soft disc. */
function Avatar({ review }: { review: GoogleReviewView }) {
  if (review.photo) {
    return (
      <img
        src={review.photo}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 rounded-full bg-paper-3 object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-3 font-semibold text-text-2"
    >
      {review.author.trim().charAt(0).toLocaleUpperCase("tr-TR")}
    </span>
  )
}

/** One Google review whole: who and when, the stars, the text, the shop's reply in a well. */
function Card({ review, t }: { review: GoogleReviewView; t: Translate }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6">
      <div className="flex items-center gap-3">
        <Avatar review={review} />
        <p className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{review.author}</span>
          <time dateTime={review.date.dateTime} className="text-sm text-text-3">
            {review.date.label}
          </time>
        </p>
      </div>
      <Stars rating={review.rating} label={review.ratingLabel} />
      {review.text && (
        <p className="text-md leading-relaxed break-words text-text-2">{review.text}</p>
      )}
      {review.reply && (
        <div className="mt-auto flex flex-col gap-1 rounded-inner bg-paper-2 p-4 text-sm">
          <p className="font-semibold">
            {t("reviews.google_reply")}
            {review.reply.date && (
              <>
                {" · "}
                <time dateTime={review.reply.date.dateTime} className="font-normal text-text-3">
                  {review.reply.date.label}
                </time>
              </>
            )}
          </p>
          <p className="leading-relaxed break-words text-text-2">{review.reply.text}</p>
        </div>
      )}
    </li>
  )
}

/**
 * The shop's Google reviews on `/yorumlar` (adr/0058), apart from its own:
 * a head with Google's own average set large, the stars and Google's
 * count, "Google'da tümünü gör" out to Google Maps; the newest reviews in
 * three columns from 1024 px (who, when, stars, text, the shop's reply);
 * a line saying they come from Google, with Google's page to write one.
 * Text only: none of it goes into structured data.
 */
export function GoogleReviews({ google, t }: { google: GoogleReviewsView; t: Translate }) {
  return (
    <section
      aria-labelledby="google-yorumlari"
      className="flex flex-col gap-6 border-t border-rule pt-8 lg:pt-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h2 id="google-yorumlari">{t("reviews.google_title")}</h2>
          <p className="flex flex-wrap items-end gap-3">
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
                <span className="font-semibold text-text">Google</span>
                {" · "}
                {t("reviews.google_count_short", { count: google.count })}
              </span>
            </span>
            <span className="sr-only">{google.label}</span>
          </p>
        </div>
        {google.allUrl && (
          <a
            href={google.allUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gf-btn gf-btn--quiet shrink-0"
          >
            {t("reviews.google_all")}
            <span className="sr-only"> {t("reviews.google_new_tab")}</span>
            <ExternalLink className="size-4.5" aria-hidden="true" strokeWidth={2} />
          </a>
        )}
      </div>
      {google.reviews.length > 0 && (
        <ul className="grid gap-(--gap-columns) md:grid-cols-2 lg:grid-cols-3">
          {google.reviews.map((review, index) => (
            <Card
              key={`${review.author}:${review.date.dateTime}:${String(index)}`}
              review={review}
              t={t}
            />
          ))}
        </ul>
      )}
      <p className="text-sm text-text-3">
        {t("reviews.google_source")}
        {google.writeUrl && (
          <>
            {" "}
            <a
              href={google.writeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-text underline underline-offset-4"
            >
              {t("reviews.google_write")}
              <span className="sr-only"> {t("reviews.google_new_tab")}</span>
            </a>
          </>
        )}
      </p>
    </section>
  )
}
