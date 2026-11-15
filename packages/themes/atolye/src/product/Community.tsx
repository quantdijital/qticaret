import { LogIn, MessageCircleQuestion, MessageSquareReply, PenLine, Star } from "lucide-react"
import type { ReactNode } from "react"
import type { ProductPageView, QuestionView, ThemeActions, Translate } from "@qticaret/ui"
import { QuestionForm, ReviewForm } from "./Forms"
import { ratingText } from "./Headline"
import { MoreList } from "./More"
import { ReviewList } from "./ReviewList"
import { communityWords, reviewListWords } from "./words"
import { DoneButton, WriteDialog } from "./Write"
import { REVIEWS_ID } from "./anchors"

/**
 * Nothing yet (owner 2026-11-06: a thin "none yet" strip beside a huge
 * form looked lopsided): one calm block across the width, the icon in a
 * round chip, what is missing, one line, the one thing to do; from 640 px
 * in a row, the button at the end.
 */
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 rounded-tile bg-paper-2 p-6 sm:flex-row sm:items-center sm:gap-6 lg:px-8">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-paper">
        {icon}
      </span>
      <p className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-title font-extrabold">{title}</span>
        <span className="text-text-2">{text}</span>
      </p>
      <div className="flex shrink-0 max-sm:*:w-full">{action}</div>
    </div>
  )
}

/** A guest's way to write: sign in and come back here. */
function SignIn({ href, label, wide }: { href: string; label: string; wide?: boolean }) {
  return (
    <a href={href} className={`gf-btn gf-btn--quiet${wide ? " w-full" : ""}`}>
      <LogIn className="size-5" aria-hidden="true" strokeWidth={1.75} />
      {label}
    </a>
  )
}

function Question({ question, t }: { question: QuestionView; t: Translate }) {
  return (
    <>
      <p className="max-w-[46rem] text-md font-semibold">{question.body}</p>
      <p className="flex flex-wrap gap-x-3 text-sm text-text-3">
        <span>{question.author}</span>
        <span>{question.date}</span>
      </p>
      {question.answers.map((answer, each) => (
        <div key={String(each)} className="flex max-w-[46rem] gap-3 rounded-media bg-paper-2 p-4">
          <MessageSquareReply
            className="mt-0.5 size-5 shrink-0 text-text-2"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          <p className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">
              {answer.byShop ? t("product.shop_answer") : answer.author}
            </span>
            <span className="text-text-2">{answer.body}</span>
          </p>
        </div>
      ))}
    </>
  )
}

/**
 * Reviews (F10.6) and questions (F10.10), as the shop approved them
 * (owner 2026-11-06: "değerlendirmeleri gösterme alanını beğenmedik …
 * soru-cevaplar kısmı dengesiz görünüyor"). Each is a summary panel on
 * the left from 1024 px (the reviews' average and spread, the questions'
 * count and a line) with its one button, "Değerlendirme yaz" or "Soru
 * sor", opening the form in a dialog (a guest: the way to sign in), and
 * the ruled list on the right; on a phone the panel comes first. With
 * none yet, one calm block across the width.
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
  const close = t("nav.close")
  const write = (wide: boolean) =>
    view.signedIn ? (
      <WriteDialog
        label={t("product.write_review")}
        title={t("product.write_review")}
        note={t("product.review_note")}
        close={close}
        icon={<PenLine className="size-5" aria-hidden="true" strokeWidth={1.75} />}
        className={`gf-btn${wide ? " w-full" : ""}`}
      >
        <ReviewForm
          productId={view.id}
          write={actions.writeReview}
          words={words}
          placeholders={{
            title: t("placeholder.review_title"),
            body: t("placeholder.review_body"),
          }}
          done={<DoneButton label={close} />}
        />
      </WriteDialog>
    ) : (
      <SignIn href={view.loginPath} label={t("product.review_sign_in")} wide={wide} />
    )
  const ask = (wide: boolean) =>
    view.signedIn ? (
      <WriteDialog
        label={t("product.ask")}
        title={t("product.ask")}
        note={t("product.question_note")}
        close={close}
        icon={<MessageCircleQuestion className="size-5" aria-hidden="true" strokeWidth={1.75} />}
        className={`gf-btn gf-btn--quiet${wide ? " w-full" : ""}`}
      >
        <QuestionForm
          productId={view.id}
          ask={actions.askQuestion}
          words={words}
          placeholder={t("placeholder.question")}
          done={<DoneButton label={close} />}
        />
      </WriteDialog>
    ) : (
      <SignIn href={view.loginPath} label={t("product.question_sign_in")} wide={wide} />
    )
  const rated = reviews.average !== null && reviews.count > 0 && reviews.items.length > 0
  return (
    <div className="flex flex-col gap-(--section-gap-s)">
      <section
        id={REVIEWS_ID}
        aria-labelledby="degerlendirmeler-baslik"
        className="flex scroll-mt-40 flex-col gap-6 lg:gap-8"
      >
        <h2 id="degerlendirmeler-baslik" className="text-section">
          {t("product.reviews")}
          {reviews.count > 0 && <span className="tabular"> ({reviews.count})</span>}
        </h2>
        {rated && reviews.average !== null ? (
          <ReviewList
            average={ratingText(reviews.average)}
            averageLabel={t("product.average", { value: ratingText(reviews.average) })}
            countText={t("reviews.count", { count: reviews.count })}
            bars={reviews.distribution ?? []}
            items={reviews.items}
            complete={reviews.items.length >= reviews.count}
            action={write(true)}
            words={reviewListWords(t)}
          />
        ) : (
          <Empty
            icon={<Star className="size-6" aria-hidden="true" strokeWidth={1.75} />}
            title={t("product.reviews_empty")}
            text={t("product.reviews_empty_text")}
            action={write(false)}
          />
        )}
      </section>

      <section aria-labelledby="sorular" className="flex scroll-mt-40 flex-col gap-6 lg:gap-8">
        <h2 id="sorular" className="text-section">
          {t("product.questions")}
          {questions.count > 0 && <span className="tabular"> ({questions.count})</span>}
        </h2>
        {questions.items.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
            <div className="lg:col-span-4">
              <div className="flex flex-col gap-5 rounded-tile bg-paper-2 p-6 lg:sticky lg:top-(--gf-stick-top) lg:p-8">
                <p className="flex items-center gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-paper">
                    <MessageCircleQuestion
                      className="size-6"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="tabular text-title font-extrabold">
                      {t("product.questions_count", { count: questions.count })}
                    </span>
                    <span className="text-sm text-text-2">{t("product.questions_lead")}</span>
                  </span>
                </p>
                {ask(true)}
              </div>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <MoreList
                more={t("product.questions_more")}
                rows={questions.items.map((question, index) => (
                  <Question key={String(index)} question={question} t={t} />
                ))}
              />
            </div>
          </div>
        ) : (
          <Empty
            icon={
              <MessageCircleQuestion className="size-6" aria-hidden="true" strokeWidth={1.75} />
            }
            title={t("product.questions_empty")}
            text={t("product.questions_empty_text")}
            action={ask(false)}
          />
        )}
      </section>
    </div>
  )
}
