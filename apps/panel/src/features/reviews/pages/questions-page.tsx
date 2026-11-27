import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import {
  answerQuestion,
  moderateAnswers,
  moderateQuestions,
  questionsQuery,
} from "@/features/reviews/api/questions"
import type { QuestionRow } from "@/features/reviews/api/questions"
import type { ReviewStatus } from "@/features/reviews/api/reviews"
import { AiButton } from "@/features/ai/components/ai-button"
import { useCan } from "@/features/auth/api/staff"
import { QuestionDialog } from "@/features/reviews/components/question-dialog"
import { ReviewsNav } from "@/features/reviews/components/reviews-nav"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/reviews/questions")
const Q = "reviews.questions"

/** Approve and reject, for a question or a customer's answer waiting for the shop. */
function Decide({
  label,
  busy,
  onDecide,
}: {
  label: string
  busy: boolean
  onDecide: (status: "approved" | "rejected") => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 gap-2" role="group" aria-label={label}>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          onDecide("approved")
        }}
      >
        {t("reviews.approve")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          onDecide("rejected")
        }}
      >
        {t("reviews.reject")}
      </Button>
    </div>
  )
}

function QuestionCard({
  question,
  onOpen,
}: {
  question: QuestionRow
  /** The question's dialog: edit, hide or show, delete; none for a role that only reads. */
  onOpen: (() => void) | null
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [answer, setAnswer] = useState("")
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["questions"] })
  }
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const decideQuestion = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      moderateQuestions({ ids: [question.id], status }),
    onSuccess: refresh,
    onError: failed,
  })
  const decideAnswer = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      moderateAnswers({ ids: [input.id], status: input.status }),
    onSuccess: refresh,
    onError: failed,
  })
  const reply = useMutation({
    mutationFn: () => answerQuestion(question.id, answer.trim()),
    onSuccess: async () => {
      toast.success(t(`${Q}.answered`))
      setAnswer("")
      await refresh()
    },
    onError: failed,
  })
  const answerId = `answer-${question.id}`
  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1">
          {question.product.title ? (
            <Link
              to="/products/$id"
              params={{ id: question.product.id }}
              className="text-[13px] text-muted-foreground hover:underline"
            >
              {question.product.title}
            </Link>
          ) : null}
          <p className="text-sm font-medium whitespace-pre-wrap">{question.body}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {question.author_name} · {formatDate(question.created_at)}
            {question.has_link ? (
              <StatusBadge tone="warning">{t("reviews.hasLink")}</StatusBadge>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {question.status === "pending" ? (
            <Decide
              label={t(`${Q}.decideQuestion`)}
              busy={decideQuestion.isPending}
              onDecide={(status) => {
                decideQuestion.mutate(status)
              }}
            />
          ) : null}
          {onOpen ? (
            <Button
              size="sm"
              variant="outline"
              aria-label={t(`${Q}.manage.editFor`, { question: question.body })}
              onClick={onOpen}
            >
              <Pencil />
              {t(`${Q}.manage.edit`)}
            </Button>
          ) : null}
        </div>
      </div>
      {question.answers.length > 0 ? (
        <ul className="flex flex-col gap-2 border-l-2 pl-4">
          {question.answers.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-0.5">
                <p className="text-sm whitespace-pre-wrap">{row.body}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {row.by_shop ? t(`${Q}.byShop`) : row.author_name} · {formatDate(row.created_at)}
                  {row.status !== "approved" ? (
                    <StatusBadge tone={row.status === "pending" ? "warning" : "neutral"}>
                      {t(`${Q}.answerStatus.${row.status}`)}
                    </StatusBadge>
                  ) : null}
                  {row.has_link ? (
                    <StatusBadge tone="warning">{t("reviews.hasLink")}</StatusBadge>
                  ) : null}
                </p>
              </div>
              {row.status === "pending" ? (
                <Decide
                  label={t(`${Q}.decideAnswer`, { author: row.author_name })}
                  busy={decideAnswer.isPending}
                  onDecide={(status) => {
                    decideAnswer.mutate({ id: row.id, status })
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {question.status !== "rejected" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (answer.trim().length >= 10) {
              reply.mutate()
            }
          }}
        >
          <label htmlFor={answerId} className="sr-only">
            {t(`${Q}.answerLabel`)}
          </label>
          <Textarea
            id={answerId}
            rows={2}
            maxLength={1000}
            placeholder={t(`${Q}.answerPlaceholder`)}
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value)
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={reply.isPending || answer.trim().length < 10}
            >
              {t(`${Q}.answer`)}
            </Button>
            {/* A draft only fills the box (Aşama 9): "Yanıtla" still sends it, or not */}
            <AiButton
              task="question_answer"
              entity={{ type: "question", id: question.id }}
              text={t("ai.reviews.replyDraft")}
              label={t("ai.reviews.answerDraftFor", { author: question.author_name })}
              note={t("ai.reviews.note")}
              onUse={setAnswer}
            />
          </div>
        </form>
      ) : null}
    </li>
  )
}

/**
 * Yorumlar ve sorular > Sorular (F10.10): customers' questions about
 * products. The shop answers in its own name (shown at once); a
 * customer's answer, from one who received the product, waits here too.
 */
export function QuestionsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status: ReviewStatus = search.status ?? "pending"
  const list = useQuery(questionsQuery(status, 0))
  const rows = list.data?.questions ?? []
  const canEdit = useCan("moderation")
  const [opened, setOpened] = useState<QuestionRow | null>(null)
  // The open question as the list reads it now (its answers change under it)
  const shown = opened ? (rows.find((row) => row.id === opened.id) ?? opened) : null
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("reviews.title")} description={t(`${Q}.description`)} />
      <ReviewsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${Q}.views`)}
          value={status}
          onChange={(next) => {
            void navigate({
              to: "/reviews/questions",
              search: { status: next === "pending" ? undefined : next },
              replace: true,
            })
          }}
          tabs={[
            { key: "pending", label: t(`${Q}.tabs.pending`) },
            { key: "approved", label: t(`${Q}.tabs.approved`) },
            { key: "rejected", label: t(`${Q}.tabs.rejected`) },
          ]}
        />
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
            {t(`${Q}.empty.${status}`)}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onOpen={
                  canEdit
                    ? () => {
                        setOpened(question)
                      }
                    : null
                }
              />
            ))}
          </ul>
        )}
      </section>
      {shown ? (
        <QuestionDialog
          key={shown.id}
          question={shown}
          productId={shown.product.id}
          onClose={() => {
            setOpened(null)
          }}
        />
      ) : null}
    </div>
  )
}
