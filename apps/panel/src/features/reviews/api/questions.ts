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
  /** The shop's own question (its FAQ), added by hand or from the AI draft. */
  by_shop: boolean
  status: ReviewStatus
  has_link: boolean
  created_at: string
  /** When the shop last changed the question's words; null as its author wrote them. */
  edited_at?: string | null
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

/** The longest question or answer the shop writes (the API's limit). */
export const QA_TEXT_MAX = 1000
/** The shortest: "Kaç cm?" is a question. */
export const QA_TEXT_MIN = 2

/** One product's questions in every state, newest first, with all their answers. */
export const productQuestionsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["questions", "product", productId],
    queryFn: () =>
      sdk.client.fetch<{ questions: QuestionRow[]; count: number; limit: number }>(
        "/admin/product-questions",
        { query: { product_id: productId } }
      ),
  })

/** The shop's own question with its answer, published at once. */
export const addShopQuestion = (body: { product_id: string; question: string; answer: string }) =>
  sdk.client.fetch<{ question: { id: string } }>("/admin/product-questions", {
    method: "POST",
    body,
  })

/** A question's words and the shop's answer; `answer: null` removes the shop's answer. */
export const editQuestion = (id: string, body: { body?: string; answer?: string | null }) =>
  sdk.client.fetch(`/admin/product-questions/${encodeURIComponent(id)}/edit`, {
    method: "POST",
    body,
  })

/** A question deleted with its answers; `restoreQuestion` brings it back. */
export const deleteQuestion = (id: string) =>
  sdk.client.fetch(`/admin/product-questions/${encodeURIComponent(id)}`, { method: "DELETE" })

export const restoreQuestion = (id: string) =>
  sdk.client.fetch(`/admin/product-questions/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  })
