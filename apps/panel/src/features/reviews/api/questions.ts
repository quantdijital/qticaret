import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { ReviewStatus } from "./reviews"

export interface AnswerRow {
  id: string
  body: string
  author_name: string
  by_shop: boolean
  status: ReviewStatus
  has_link: boolean
  created_at: string
}

export interface QuestionRow {
  id: string
  body: string
  author_name: string
  status: ReviewStatus
  has_link: boolean
  created_at: string
  product: { id: string; title: string | null }
  answers: AnswerRow[]
}

/** Questions by state with all their answers (F10.10); "waiting" also holds answers to look at. */
export const questionsQuery = (status: ReviewStatus, page: number) =>
  queryOptions({
    queryKey: ["questions", status, page],
    queryFn: () =>
      sdk.client.fetch<{ questions: QuestionRow[]; count: number; limit: number }>(
        "/admin/product-questions",
        { query: { status, offset: page * 20 } }
      ),
  })

export const moderateQuestions = (body: { ids: string[]; status: "approved" | "rejected" }) =>
  sdk.client.fetch("/admin/product-questions/moderate", { method: "POST", body })

export const moderateAnswers = (body: { ids: string[]; status: "approved" | "rejected" }) =>
  sdk.client.fetch("/admin/product-answers/moderate", { method: "POST", body })

/** The shop answers in its own name: shown at once. */
export const answerQuestion = (id: string, body: string) =>
  sdk.client.fetch(`/admin/product-questions/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    body: { body },
  })
