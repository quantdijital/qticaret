import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { ProductAnswer } from "./models/product-answer"
import { ProductQuestion } from "./models/product-question"

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

  @InjectTransactionManager()
  protected async recount_(
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
