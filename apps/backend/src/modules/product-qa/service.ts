import type { Context } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { ProductAnswer } from "./models/product-answer"
import { ProductQuestion } from "./models/product-question"
import { editQuestion_, undoEdit_ } from "./editing"
import type { QuestionEdit, QuestionEditUndo } from "./types"

export type { QuestionEdit, QuestionEditUndo } from "./types"

export type Moderation = "approved" | "rejected"

/** Product questions and their answers (F10.10, adr/0037 §4). */
class ProductQaModuleService extends MedusaService({ ProductQuestion, ProductAnswer }) {
  /** Approves or rejects questions. */
  @InjectTransactionManager()
  async moderateQuestions(
    input: { ids: string[]; status: Moderation; by: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const now = new Date()
    await this.updateProductQuestions(
      input.ids.map((id) => ({
        id,
        status: input.status,
        moderated_by: input.by,
        moderated_at: now,
      })),
      sharedContext
    )
  }

  /** Approves or rejects answers, and counts each touched question's approved ones again. */
  @InjectTransactionManager()
  async moderateAnswers(
    input: { ids: string[]; status: Moderation; by: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const answers = await this.listProductAnswers(
      { id: input.ids },
      { select: ["id", "question_id"] },
      sharedContext
    )
    const now = new Date()
    await this.updateProductAnswers(
      answers.map((answer) => ({
        id: answer.id,
        status: input.status,
        moderated_by: input.by,
        moderated_at: now,
      })),
      sharedContext
    )
    await this.recount_([...new Set(answers.map((answer) => answer.question_id))], sharedContext)
  }

  /** The shop answers a question: shown at once, and the question with it. */
  @InjectTransactionManager()
  async answerAsShop(
    input: { question_id: string; user_id: string; author_name: string; body: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string }> {
    const question = await this.retrieveProductQuestion(input.question_id, {}, sharedContext)
    const now = new Date()
    const answer = await this.createProductAnswers(
      {
        question_id: question.id,
        product_id: question.product_id,
        author_kind: "shop",
        user_id: input.user_id,
        customer_id: null,
        author_name: input.author_name,
        body: input.body,
        status: "approved",
        moderated_by: input.user_id,
        moderated_at: now,
      },
      sharedContext
    )
    if (question.status !== "approved") {
      await this.updateProductQuestions(
        { id: question.id, status: "approved", moderated_by: input.user_id, moderated_at: now },
        sharedContext
      )
    }
    await this.recount_([question.id], sharedContext)
    return { id: answer.id }
  }

  /**
   * The shop's own questions with their answers (adr/0074 §5 madde 4, the
   * product's FAQ): both in the shop's name and shown at once, as the
   * shop's answer is. No customer is named; nothing is sent to anyone.
   */
  @InjectTransactionManager()
  async addShopQuestions(
    input: {
      product_id: string
      user_id: string
      author_name: string
      items: { question: string; answer: string }[]
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ question_ids: string[]; answer_ids: string[] }> {
    const now = new Date()
    const shop = {
      product_id: input.product_id,
      author_kind: "shop" as const,
      customer_id: null,
      user_id: input.user_id,
      author_name: input.author_name,
      status: "approved" as const,
      has_link: false,
      moderated_by: input.user_id,
      moderated_at: now,
    }
    const questions = await this.createProductQuestions(
      input.items.map((item) => ({ ...shop, body: item.question, answer_count: 1 })),
      sharedContext
    )
    const answers = await this.createProductAnswers(
      questions.map((question, index) => ({
        ...shop,
        question_id: question.id,
        body: input.items[index]?.answer ?? "",
      })),
      sharedContext
    )
    return {
      question_ids: questions.map((question) => question.id),
      answer_ids: answers.map((answer) => answer.id),
    }
  }

  /** The shop's questions added together taken back (a failed step's undo), answers and all. */
  @InjectTransactionManager()
  async removeShopQuestions(
    input: { question_ids: string[]; answer_ids: string[] },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (input.answer_ids.length > 0) {
      await this.deleteProductAnswers(input.answer_ids, sharedContext)
    }
    if (input.question_ids.length > 0) {
      await this.deleteProductQuestions(input.question_ids, sharedContext)
    }
  }

  /**
   * The shop edits a question from the panel: its words (any author's: a
   * typo, a phone number taken out) and the shop's own answer, written,
   * replaced or removed (`answer: null`). A customer's answer is never
   * rewritten here; it is approved or hidden. A waiting question the shop
   * answers goes out with its answer (as `answerAsShop`); a hidden one
   * stays hidden: hiding and showing are moderation's. Returns what the
   * undo puts back.
   */
  @InjectTransactionManager()
  async editQuestion(
    input: QuestionEdit,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<QuestionEditUndo> {
    return editQuestion_(this, input, sharedContext)
  }

  /** An edit taken back (a failed workflow's compensation). */
  @InjectTransactionManager()
  async undoEdit(
    undo: QuestionEditUndo,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await undoEdit_(this, undo, sharedContext)
  }

  /**
   * A question taken off with its answers (soft: "Geri al" brings them
   * back). The question goes first, then its answers, so a restore knows
   * them by the time (an answer the shop removed earlier stays removed).
   */
  @InjectTransactionManager()
  async removeQuestion(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; product_id: string }> {
    const question = await this.retrieveProductQuestion(
      id,
      { select: ["id", "product_id"] },
      sharedContext
    )
    await this.softDeleteProductQuestions([id], {}, sharedContext)
    const answers = await this.listProductAnswers(
      { question_id: id },
      { select: ["id"] },
      sharedContext
    )
    if (answers.length > 0) {
      await this.softDeleteProductAnswers(
        answers.map((answer) => answer.id),
        {},
        sharedContext
      )
    }
    return { id, product_id: question.product_id }
  }

  /** A removed question back, with the answers removed with it. */
  @InjectTransactionManager()
  async restoreQuestion(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; product_id: string }> {
    const [question] = await this.listProductQuestions(
      { id, deleted_at: { $ne: null } },
      { take: 1, withDeleted: true, select: ["id", "product_id", "deleted_at"] },
      sharedContext
    )
    if (!question?.deleted_at) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "questions.unknown")
    }
    const answers = await this.listProductAnswers(
      { question_id: id, deleted_at: { $gte: question.deleted_at } },
      { withDeleted: true, select: ["id"] },
      sharedContext
    )
    await this.restoreProductQuestions([id], {}, sharedContext)
    if (answers.length > 0) {
      await this.restoreProductAnswers(
        answers.map((answer) => answer.id),
        {},
        sharedContext
      )
    }
    return { id, product_id: question.product_id }
  }

  /**
   * A customer erased (KVKK, L9): every question and answer of theirs
   * carries the placeholder name, deleted ones too, so "Geri al" never
   * brings their name back. The generated update does not reach a deleted
   * row (see wholesale's `clearDeletedAccounts`), so it is written here.
   */
  @InjectTransactionManager()
  async eraseAuthor(
    input: { customer_id: string; name: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    for (const table of ["product_question", "product_answer"] as const) {
      await manager.execute(`update "${table}" set "author_name" = ? where "customer_id" = ?`, [
        input.name,
        input.customer_id,
      ])
    }
  }

  /** Each question's approved answers counted again (its `answer_count`). */
  @InjectTransactionManager()
  async recount_(
    questionIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    for (const id of questionIds) {
      const approved = await this.listProductAnswers(
        { question_id: id, status: "approved" },
        { select: ["id"] },
        sharedContext
      )
      await this.updateProductQuestions({ id, answer_count: approved.length }, sharedContext)
    }
  }
}

export default ProductQaModuleService
