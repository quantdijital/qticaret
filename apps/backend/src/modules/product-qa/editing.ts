import type { Context } from "@medusajs/framework/types"
import { readsAsLink } from "../../lib/text/link-like"
import type ProductQaModuleService from "./service"
import type { QuestionEdit, QuestionEditUndo } from "./types"

/** The body of `ProductQaModuleService.editQuestion`, in its transaction. */
export async function editQuestion_(
  service: ProductQaModuleService,
  input: QuestionEdit,
  sharedContext: Context
): Promise<QuestionEditUndo> {
  const question = await service.retrieveProductQuestion(
    input.id,
    {
      select: [
        "id",
        "product_id",
        "body",
        "has_link",
        "status",
        "moderated_by",
        "moderated_at",
        "edited_by",
        "edited_at",
      ],
    },
    sharedContext
  )
  const undo: QuestionEditUndo = {
    id: question.id,
    body: question.body,
    has_link: question.has_link,
    status: question.status,
    moderated_by: question.moderated_by,
    moderated_at: question.moderated_at ? new Date(question.moderated_at).toISOString() : null,
    edited_by: question.edited_by,
    edited_at: question.edited_at ? new Date(question.edited_at).toISOString() : null,
    answer: null,
  }
  if (input.body !== undefined) {
    await service.updateProductQuestions(
      {
        id: question.id,
        body: input.body,
        has_link: readsAsLink(input.body),
        // The panel says the words are the shop's edit, not as their author wrote them
        edited_by: input.user_id,
        edited_at: new Date(),
      },
      sharedContext
    )
  }
  if (input.answer !== undefined) {
    const [own] = await service.listProductAnswers(
      { question_id: question.id, author_kind: "shop" },
      { take: 1, order: { created_at: "ASC" }, select: ["id", "body"] },
      sharedContext
    )
    if (own && input.answer !== null) {
      await service.updateProductAnswers({ id: own.id, body: input.answer }, sharedContext)
      undo.answer = { kind: "changed", id: own.id, body: own.body }
    } else if (own) {
      await service.softDeleteProductAnswers([own.id], {}, sharedContext)
      undo.answer = { kind: "removed", id: own.id }
    } else if (input.answer !== null) {
      const now = new Date()
      const created = await service.createProductAnswers(
        {
          question_id: question.id,
          product_id: question.product_id,
          author_kind: "shop",
          customer_id: null,
          user_id: input.user_id,
          author_name: input.author_name,
          body: input.answer,
          status: "approved",
          moderated_by: input.user_id,
          moderated_at: now,
        },
        sharedContext
      )
      undo.answer = { kind: "added", id: created.id }
    }
    if (input.answer !== null && question.status === "pending") {
      await service.updateProductQuestions(
        {
          id: question.id,
          status: "approved",
          moderated_by: input.user_id,
          moderated_at: new Date(),
        },
        sharedContext
      )
    }
    await service.recount_([question.id], sharedContext)
  }
  return undo
}

/** The body of `ProductQaModuleService.undoEdit`, in its transaction. */
export async function undoEdit_(
  service: ProductQaModuleService,
  undo: QuestionEditUndo,
  sharedContext: Context
): Promise<void> {
  await service.updateProductQuestions(
    {
      id: undo.id,
      body: undo.body,
      has_link: undo.has_link,
      status: undo.status,
      moderated_by: undo.moderated_by,
      moderated_at: undo.moderated_at ? new Date(undo.moderated_at) : null,
      edited_by: undo.edited_by,
      edited_at: undo.edited_at ? new Date(undo.edited_at) : null,
    },
    sharedContext
  )
  const answer = undo.answer
  if (answer?.kind === "changed") {
    await service.updateProductAnswers({ id: answer.id, body: answer.body }, sharedContext)
  } else if (answer?.kind === "removed") {
    await service.restoreProductAnswers([answer.id], {}, sharedContext)
  } else if (answer?.kind === "added") {
    await service.deleteProductAnswers([answer.id], sharedContext)
  }
  await service.recount_([undo.id], sharedContext)
}
