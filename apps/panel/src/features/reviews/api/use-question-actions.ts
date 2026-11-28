import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { errorText } from "@/lib/errors"
import {
  addShopQuestion,
  deleteQuestion,
  editQuestion,
  moderateQuestions,
  restoreQuestion,
} from "./questions"

const Q = "reviews.questions.manage"

/** What the dialog saves: a new question of the shop's, or a question's changes. */
export type QuestionSave =
  | { kind: "add"; product_id: string; question: string; answer: string }
  | { kind: "edit"; id: string; body?: string; answer?: string | null }

/**
 * A question's actions from the product page and Yorumlar ve sorular ›
 * Sorular (owner 2026-11-27): added or edited, hidden or shown again,
 * deleted with "Geri al" in its toast. Every list of questions reads again
 * after each (`["questions"]`: both screens' lists).
 */
export function useQuestionActions() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ["questions"] })
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const save = useMutation({
    mutationFn: async (input: QuestionSave) => {
      if (input.kind === "add") {
        await addShopQuestion({
          product_id: input.product_id,
          question: input.question,
          answer: input.answer,
        })
        return
      }
      await editQuestion(input.id, {
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.answer === undefined ? {} : { answer: input.answer }),
      })
    },
    onSuccess: async (_, input) => {
      toast.success(t(input.kind === "add" ? `${Q}.added` : `${Q}.saved`))
      await refresh()
    },
    onError: failed,
  })
  const visibility = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      moderateQuestions({ ids: [input.id], status: input.status }),
    onSuccess: async (_, input) => {
      toast.success(t(input.status === "approved" ? `${Q}.shown` : `${Q}.hidden`))
      await refresh()
    },
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: async (_, id) => {
      toast.success(t(`${Q}.deleted`), {
        action: {
          label: t(`${Q}.undo`),
          onClick: () => {
            restoreQuestion(id).then(async () => {
              toast.success(t(`${Q}.restored`))
              await refresh()
            }, failed)
          },
        },
      })
      await refresh()
    },
    onError: failed,
  })
  return { save, visibility, remove }
}
