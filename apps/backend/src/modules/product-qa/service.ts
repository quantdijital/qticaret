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
