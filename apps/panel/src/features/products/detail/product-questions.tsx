import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { productQuestionsQuery } from "@/features/reviews/api/questions"
import type { QuestionRow } from "@/features/reviews/api/questions"
import { QuestionStatus } from "@/features/reviews/components/question-status"
import { errorText } from "@/lib/errors"

const F = "products.faq"

/** The answer a row shows under its question: the shop's, else the first approved one. */
const shownAnswer = (question: QuestionRow) =>
  question.answers.find((answer) => answer.by_shop) ??
  question.answers.find((answer) => answer.status === "approved") ??
  null

function QuestionLine({ question }: { question: QuestionRow }) {
  const { t } = useTranslation()
  const answer = shownAnswer(question)
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm font-medium">{question.body}</span>
        <span className="line-clamp-2 text-[13px] text-muted-foreground">
          {answer ? answer.body : t(`${F}.noAnswer`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {question.by_shop ? t("reviews.questions.byShop") : question.author_name} ·{" "}
          {formatDate(question.created_at)}
        </span>
      </span>
      <QuestionStatus question={question} />
    </>
  )
}

/**
 * The product's questions and answers on its page (owner 2026-11-27):
 * the shop's own and customers', every state, newest first. A row opens
 * the question's dialog (edit, hide or show, delete) when the role may
 * moderate; otherwise it only reads.
 */
export function ProductQuestions({
  productId,
  onOpen,
}: {
  productId: string
  onOpen: ((question: QuestionRow) => void) | null
}) {
  const { t } = useTranslation()
  const list = useQuery(productQuestionsQuery(productId))
  if (list.isError) {
    return (
      <ErrorState
        text={errorText(t, list.error)}
        onRetry={() => {
          void list.refetch()
        }}
      />
    )
  }
  if (!list.data) {
    return <Skeleton className="h-20 w-full" />
  }
  const rows = list.data.questions
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t(`${F}.none`)}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y rounded-md border" aria-label={t(`${F}.listLabel`)}>
        {rows.map((question) => (
          <li key={question.id}>
            {onOpen ? (
              <button
                type="button"
                aria-label={t(`${F}.open`, { question: question.body })}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                onClick={() => {
                  onOpen(question)
                }}
              >
                <QuestionLine question={question} />
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <QuestionLine question={question} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {list.data.count > rows.length ? (
        <Link
          to="/reviews/questions"
          search={{ status: "approved" }}
          className="text-sm text-muted-foreground hover:underline"
        >
          {t(`${F}.more`, { shown: rows.length, count: list.data.count })}
        </Link>
      ) : null}
    </div>
  )
}
