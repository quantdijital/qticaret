"use client"

import { Star } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction, QuestionsView, ReviewsView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const INITIAL: ActionResult = { ok: false, error: null }

export interface CommunityWords {
  reviews: string
  noReviews: string
  writeReview: string
  rating: string
  reviewTitle: string
  reviewBody: string
  send: string
  sending: string
  reviewSent: string
  verified: string
  questions: string
  noQuestions: string
  ask: string
  questionBody: string
  questionSent: string
  signIn: string
  signInToWrite: string
  average: string
  errors: Record<string, string>
  fallback: string
}

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((each) => (
        <Star
          key={each}
          aria-hidden="true"
          className={cn(
            "size-4",
            each <= Math.round(value) ? "fill-foreground" : "text-muted-foreground"
          )}
        />
      ))}
    </span>
  )
}

function Result({ state, ok, words }: { state: ActionResult; ok: string; words: CommunityWords }) {
  return (
    <p role="status" className="text-sm empty:hidden">
      {state.error ? (
        <span className="text-sale">{words.errors[state.error] ?? words.fallback}</span>
      ) : state.ok ? (
        <span className="text-success">{ok}</span>
      ) : null}
    </p>
  )
}

const FIELD =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-foreground"

/** Reviews (F10.6) and questions (F10.10): what was approved, and a form for a signed-in customer. */
export function ProductCommunity({
  productId,
  reviews,
  questions,
  signedIn,
  loginPath,
  writeReview,
  askQuestion,
  words,
}: {
  productId: string
  reviews: ReviewsView
  questions: QuestionsView
  signedIn: boolean
  loginPath: string
  writeReview: FormAction
  askQuestion: FormAction
  words: CommunityWords
}) {
  const [reviewState, sendReview, reviewPending] = useActionState(writeReview, INITIAL)
  const [questionState, sendQuestion, questionPending] = useActionState(askQuestion, INITIAL)
  const signIn = (
    <p className="text-sm text-muted-foreground">
      {words.signInToWrite}{" "}
      <a href={loginPath} className="font-medium text-foreground underline">
        {words.signIn}
      </a>
    </p>
  )
  return (
    <div className="grid gap-10 border-t pt-10 lg:grid-cols-2">
      <section aria-labelledby="yorumlar" className="flex flex-col gap-4">
        <h2 id="yorumlar" className="text-2xl">
          {words.reviews} ({reviews.count})
        </h2>
        {reviews.average !== null && (
          <p className="flex items-center gap-2 text-sm">
            <Stars
              value={reviews.average}
              label={words.average.replace("{value}", String(reviews.average))}
            />
            <span className="font-semibold">{reviews.average}</span>
          </p>
        )}
        {reviews.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{words.noReviews}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {reviews.items.map((review, index) => (
              <li key={String(index)} className="flex flex-col gap-1 py-3 text-sm">
                <Stars value={review.rating} label={String(review.rating)} />
                {review.title && <p className="font-semibold">{review.title}</p>}
                <p>{review.body}</p>
                <p className="text-xs text-muted-foreground">
                  {review.author} · {review.date}
                  {review.verified && ` · ${words.verified}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {signedIn ? (
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">{words.writeReview}</summary>
            <form action={sendReview} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="product_id" value={productId} />
              <label className="text-sm">
                {words.rating}
                <select name="rating" required defaultValue="5" className={FIELD}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {"★".repeat(value)}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="title"
                maxLength={100}
                placeholder={words.reviewTitle}
                className={FIELD}
              />
              <textarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder={words.reviewBody}
                className={FIELD}
              />
              <button
                type="submit"
                disabled={reviewPending}
                className="h-10 rounded-button bg-foreground text-sm font-semibold text-background disabled:opacity-50"
              >
                {reviewPending ? words.sending : words.send}
              </button>
              <Result state={reviewState} ok={words.reviewSent} words={words} />
            </form>
          </details>
        ) : (
          signIn
        )}
      </section>

      <section aria-labelledby="sorular" className="flex flex-col gap-4">
        <h2 id="sorular" className="text-2xl">
          {words.questions} ({questions.count})
        </h2>
        {questions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{words.noQuestions}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {questions.items.map((question, index) => (
              <li key={String(index)} className="flex flex-col gap-2 py-3 text-sm">
                <p className="font-medium">{question.body}</p>
                <p className="text-xs text-muted-foreground">
                  {question.author} · {question.date}
                </p>
                {question.answers.map((answer, each) => (
                  <p key={String(each)} className="border-l-2 pl-3">
                    {answer.body}
                    <span className="block text-xs text-muted-foreground">{answer.author}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
        {signedIn ? (
          <form action={sendQuestion} className="flex flex-col gap-2">
            <input type="hidden" name="product_id" value={productId} />
            <textarea
              name="body"
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              placeholder={words.questionBody}
              className={FIELD}
            />
            <button
              type="submit"
              disabled={questionPending}
              className="h-10 rounded-button border border-foreground text-sm font-semibold disabled:opacity-50"
            >
              {questionPending ? words.sending : words.ask}
            </button>
            <Result state={questionState} ok={words.questionSent} words={words} />
          </form>
        ) : (
          signIn
        )}
      </section>
    </div>
  )
}
