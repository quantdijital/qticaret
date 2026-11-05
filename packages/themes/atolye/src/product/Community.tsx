import { BadgeCheck, MessageSquareReply } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductPageView, ReviewView, ThemeActions, Translate } from "@qticaret/ui"
import { fillOf } from "../parts/FreeShippingMeter"
import { Stars } from "../parts/Stars"
import { QuestionForm, ReviewForm } from "./Forms"
import { ratingText } from "./Headline"
import { communityWords } from "./words"

/** The product's reviews in short: the average set large, the stars, the count, the spread 5 to 1. */
function Summary({ view, t }: { view: ProductPageView; t: Translate }) {
  const { average, count, distribution } = view.reviews
  if (average === null || count === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-5 rounded-tile bg-paper-2 p-6 lg:p-8">
      <p className="flex items-end gap-3">
        <span className="tabular text-figure leading-none font-extrabold tracking-(--tracking-display)">
          {ratingText(average)}
        </span>
        <span className="flex flex-col gap-1 pb-1">
          <Stars rating={average} size="size-5" />
          <span className="text-sm text-text-2">{t("reviews.count", { count })}</span>
        </span>
        <span className="sr-only">{t("product.average", { value: ratingText(average) })}</span>
      </p>
      {distribution && distribution.length > 0 && (
        <ul aria-label={t("reviews.distribution")} className="flex flex-col gap-1.5">
          {distribution.map((bar) => (
            <li
              key={bar.stars}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"
            >
              <span aria-hidden="true" className="text-text-2">
                {t("reviews.bar_stars", { stars: bar.stars })}
              </span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-paper-3">
                <span className={`block h-full rounded-pill bg-star ${fillOf(bar.percent)}`} />
              </span>
              <span aria-hidden="true" className="tabular text-right text-text-2">
                {bar.count}
              </span>
              <span className="sr-only">{bar.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Review({ review, t }: { review: ReviewView; t: Translate }) {
  const photos = review.photos ?? []
  return (
    <li className="flex flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6">
      <Stars rating={review.rating} label={t("reviews.stars", { rating: review.rating })} />
      {review.title && <h3 className="text-md tracking-[-0.01em]">{review.title}</h3>}
      <p className="text-md leading-relaxed text-text-2">{review.body}</p>
      {photos.length > 0 && (
        <ul aria-label={t("reviews.photos")} className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <li key={photo.image.src}>
              <a
                href={photo.image.src}
                target="_blank"
                rel="noopener"
                className="relative block size-20 overflow-hidden rounded-inner bg-paper-2"
              >
                <ResponsiveImage
                  image={{
                    ...photo.image,
                    alt: t("reviews.photo_alt", { author: review.author, n: index + 1 }),
                  }}
                  sizes="80px"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          {review.author}
          {review.verified && (
            <BadgeCheck
              className="size-4 text-ok"
              role="img"
              aria-label={t("product.verified")}
              strokeWidth={2}
            />
          )}
        </span>
        <span className="text-text-3">{review.date}</span>
      </p>
    </li>
  )
}

/**
 * Reviews (F10.6) and questions (F10.10), as the shop approved them. The
 * reviews: the summary panel beside the cards (the stars, the title, the
 * text whole, the customer's photos, the name with its verified mark and
 * the date), "write a review" opening under the summary for a signed-in
 * customer, the way to sign in for a guest. The questions with the
 * shop's answers on a filled well, the form beside them.
 */
export function Community({
  view,
  t,
  actions,
}: {
  view: ProductPageView
  t: Translate
  actions: ThemeActions
}) {
  const words = communityWords(t)
  const { reviews, questions } = view
  const signIn = (
    <p className="text-sm text-text-2">
      {t("product.sign_in_to_write")}{" "}
      <a href={view.loginPath} className="gf-link min-h-0 text-text">
        {t("account.login_link")}
      </a>
    </p>
  )
  return (
    <div className="flex flex-col gap-(--section-gap-s)">
      <section
        id="degerlendirmeler"
        aria-labelledby="degerlendirmeler-baslik"
        className="flex scroll-mt-40 flex-col gap-6 lg:gap-10"
      >
        <h2 id="degerlendirmeler-baslik" className="text-section">
          {t("product.reviews")}
          <span className="tabular"> ({reviews.count})</span>
        </h2>
        <div className="grid gap-(--gap-columns) lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-4">
            <Summary view={view} t={t} />
            {view.signedIn ? (
              <details className="group/yaz rounded-tile bg-paper-2">
                <summary className="flex min-h-12 cursor-pointer items-center px-5 font-semibold">
                  {t("product.write_review")}
                </summary>
                <div className="px-5 pt-1 pb-5">
                  <ReviewForm
                    productId={view.id}
                    write={actions.writeReview}
                    words={words}
                    placeholders={{
                      title: t("placeholder.review_title"),
                      body: t("placeholder.review_body"),
                    }}
                  />
                </div>
              </details>
            ) : (
              signIn
            )}
          </div>
          <div className="lg:col-span-8">
            {reviews.items.length === 0 ? (
              <p className="rounded-tile bg-paper-2 p-6 text-text-2">{t("product.no_reviews")}</p>
            ) : (
              <ul className="grid gap-(--gap-columns) md:grid-cols-[repeat(2,minmax(0,1fr))]">
                {reviews.items.map((review, index) => (
                  <Review
                    key={`${review.author}:${review.date}:${String(index)}`}
                    review={review}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="sorular" className="flex flex-col gap-6 lg:gap-10">
        <h2 id="sorular" className="text-section">
          {t("product.questions")}
          <span className="tabular"> ({questions.count})</span>
        </h2>
        <div className="grid gap-(--gap-columns) lg:grid-cols-12">
          <div className="lg:col-span-8">
            {questions.items.length === 0 ? (
              <p className="rounded-tile bg-paper-2 p-6 text-text-2">{t("product.no_questions")}</p>
            ) : (
              <ul className="flex flex-col gap-6">
                {questions.items.map((question, index) => (
                  <li key={String(index)} className="flex flex-col gap-3">
                    <p className="text-md font-semibold">{question.body}</p>
                    <p className="flex flex-wrap gap-x-3 text-sm text-text-3">
                      <span>{question.author}</span>
                      <span>{question.date}</span>
                    </p>
                    {question.answers.map((answer, each) => (
                      <div key={String(each)} className="flex gap-3 rounded-media bg-paper-2 p-4">
                        <MessageSquareReply
                          className="mt-0.5 size-5 shrink-0 text-text-2"
                          aria-hidden="true"
                          strokeWidth={1.75}
                        />
                        <p className="flex flex-col gap-1 text-sm">
                          <span>{answer.body}</span>
                          <span className="font-semibold text-text-2">
                            {answer.byShop ? t("product.shop_answer") : answer.author}
                          </span>
                        </p>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lg:col-span-4">
            {view.signedIn ? (
              <div className="rounded-tile bg-paper-2 p-5">
                <QuestionForm
                  productId={view.id}
                  ask={actions.askQuestion}
                  words={words}
                  placeholder={t("placeholder.question")}
                />
              </div>
            ) : (
              signIn
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
