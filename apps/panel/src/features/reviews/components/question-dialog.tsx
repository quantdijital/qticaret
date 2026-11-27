import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { useCan } from "@/features/auth/api/staff"
import { QA_TEXT_MAX, QA_TEXT_MIN } from "@/features/reviews/api/questions"
import type { QuestionRow } from "@/features/reviews/api/questions"
import { useQuestionActions } from "@/features/reviews/api/use-question-actions"
import { QuestionStatus } from "./question-status"

const Q = "reviews.questions.manage"

const lengthIssue = (value: string): "short" | "long" | null =>
  value.length < QA_TEXT_MIN ? "short" : value.length > QA_TEXT_MAX ? "long" : null

/**
 * One question in the standard dialog (owner 2026-11-27): its words and
 * the shop's own answer edited, hidden or shown again, deleted after
 * asking ("Geri al" in the toast). `question: null` adds the shop's own
 * question with its answer to the product, published at once. A
 * customer's answers are listed, never rewritten: they are approved or
 * hidden on the Sorular screen.
 */
export function QuestionDialog({
  question,
  productId,
  onClose,
}: {
  question: QuestionRow | null
  /** The product a new question goes on. */
  productId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const canDelete = useCan("settings")
  const { save, visibility, remove } = useQuestionActions()
  const own = question?.answers.find((answer) => answer.by_shop) ?? null
  const others = question?.answers.filter((answer) => answer !== own) ?? []
  const [body, setBody] = useState(question?.body ?? "")
  const [answer, setAnswer] = useState(own?.body ?? "")
  const [asking, setAsking] = useState(false)
  const [touched, setTouched] = useState(false)
  const bodyText = body.trim()
  const answerText = answer.trim()
  const bodyChanged = bodyText !== (question?.body ?? "").trim()
  const answerChanged = answerText !== (own?.body ?? "").trim()
  const bodyIssue = lengthIssue(bodyText)
  // A new question needs its answer; an edit may leave the shop's answer out (removed)
  const answerIssue = answerText === "" && question !== null ? null : lengthIssue(answerText)
  const busy = save.isPending || visibility.isPending || remove.isPending
  const submit = () => {
    setTouched(true)
    if (bodyIssue || answerIssue) {
      return
    }
    const done = { onSuccess: onClose }
    if (question === null) {
      save.mutate(
        { kind: "add", product_id: productId, question: bodyText, answer: answerText },
        done
      )
      return
    }
    save.mutate(
      {
        kind: "edit",
        id: question.id,
        ...(bodyChanged ? { body: bodyText } : {}),
        ...(answerChanged ? { answer: answerText === "" ? null : answerText } : {}),
      },
      done
    )
  }
  const bodyId = `question-body-${question?.id ?? "new"}`
  const answerId = `question-answer-${question?.id ?? "new"}`
  const about = question
    ? [
        question.by_shop ? t("reviews.questions.byShop") : question.author_name,
        formatDate(question.created_at),
      ].join(" · ")
    : t(`${Q}.newDescription`)
  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        title={t(question ? `${Q}.editTitle` : `${Q}.addTitle`)}
        description={about}
        dirty={bodyChanged || answerChanged}
        canSubmit={!busy && (question === null || bodyChanged || answerChanged)}
        saving={save.isPending}
        submitLabel={t(question ? `${Q}.save` : `${Q}.add`)}
        initialFocus={bodyId}
        footerStart={
          question ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  visibility.mutate(
                    {
                      id: question.id,
                      status: question.status === "approved" ? "rejected" : "approved",
                    },
                    { onSuccess: onClose }
                  )
                }}
              >
                {t(question.status === "approved" ? `${Q}.hide` : `${Q}.show`)}
              </Button>
              {canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive-text"
                  disabled={busy}
                  onClick={() => {
                    setAsking(true)
                  }}
                >
                  {t(`${Q}.delete`)}
                </Button>
              ) : null}
            </div>
          ) : null
        }
        onSubmit={submit}
      >
        {question ? (
          <div className="flex flex-wrap items-center gap-2">
            <QuestionStatus question={question} />
            {question.edited_at && !question.by_shop ? (
              <StatusBadge tone="info">
                {t(`${Q}.editedByShop`, { when: formatDate(question.edited_at) })}
              </StatusBadge>
            ) : null}
            {question.product.title ? (
              <span className="text-sm text-muted-foreground">{question.product.title}</span>
            ) : null}
          </div>
        ) : null}
        <Field
          label={t(`${Q}.question`)}
          htmlFor={bodyId}
          hint={question && !question.by_shop ? t(`${Q}.customerHint`) : undefined}
          error={touched && bodyIssue ? t(`${Q}.issues.${bodyIssue}`) : undefined}
        >
          <Textarea
            id={bodyId}
            rows={2}
            maxLength={QA_TEXT_MAX}
            value={body}
            placeholder={t(`${Q}.questionPlaceholder`)}
            aria-invalid={touched && bodyIssue !== null}
            onChange={(event) => {
              setBody(event.target.value)
            }}
          />
        </Field>
        <Field
          label={t(`${Q}.answer`)}
          htmlFor={answerId}
          hint={t(question ? `${Q}.answerHint` : `${Q}.answerHintNew`)}
          error={touched && answerIssue ? t(`${Q}.issues.${answerIssue}`) : undefined}
        >
          <Textarea
            id={answerId}
            rows={4}
            maxLength={QA_TEXT_MAX}
            value={answer}
            placeholder={t(`${Q}.answerPlaceholder`)}
            aria-invalid={touched && answerIssue !== null}
            onChange={(event) => {
              setAnswer(event.target.value)
            }}
          />
        </Field>
        {others.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={t(`${Q}.customerAnswers`)}>
            <p className="text-sm font-medium">{t(`${Q}.customerAnswers`)}</p>
            <ul className="flex flex-col gap-2 border-l-2 pl-3">
              {others.map((row) => (
                <li key={row.id} className="flex flex-col gap-0.5">
                  <p className="text-sm whitespace-pre-wrap">{row.body}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {row.author_name} · {formatDate(row.created_at)}
                    {row.status !== "approved" ? (
                      <StatusBadge tone={row.status === "pending" ? "warning" : "neutral"}>
                        {t(`reviews.questions.answerStatus.${row.status}`)}
                      </StatusBadge>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t(`${Q}.customerAnswersHint`)}</p>
          </section>
        ) : null}
      </FormDialog>
      {question ? (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={t(`${Q}.deleteConfirm.title`)}
          description={t(`${Q}.deleteConfirm.description`)}
          confirmLabel={t(`${Q}.deleteConfirm.action`)}
          destructive
          onConfirm={() => {
            setAsking(false)
            remove.mutate(question.id, { onSuccess: onClose })
          }}
        />
      ) : null}
    </>
  )
}
