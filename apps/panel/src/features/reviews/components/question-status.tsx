import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { QuestionRow } from "@/features/reviews/api/questions"

/** Where a question stands, in the shop's words. */
type QuestionState = "published" | "hidden" | "waiting"

/**
 * Yayında: on the storefront. Gizli: hidden by the shop. Yanıt bekliyor: a
 * customer's question not out yet; answering it publishes it.
 */
function questionState(question: Pick<QuestionRow, "status">): QuestionState {
  return question.status === "approved"
    ? "published"
    : question.status === "rejected"
      ? "hidden"
      : "waiting"
}

const TONE = { published: "success", hidden: "neutral", waiting: "warning" } as const

export function QuestionStatus({ question }: { question: Pick<QuestionRow, "status"> }) {
  const { t } = useTranslation()
  const state = questionState(question)
  return (
    <StatusBadge tone={TONE[state]}>{t(`reviews.questions.manage.state.${state}`)}</StatusBadge>
  )
}
