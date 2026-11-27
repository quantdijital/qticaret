import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_QA_MODULE } from "../../modules/product-qa"
import type ProductQaModuleService from "../../modules/product-qa/service"
import type { QuestionEditUndo } from "../../modules/product-qa/service"
import { brandOf } from "../messaging/brand"

/**
 * The shop manages a product's questions from the panel (owner
 * 2026-11-27): a question and answer added by hand in the shop's name
 * (published at once, as the FAQ draft's are), a question's words and the
 * shop's own answer edited, a question removed with its answers and
 * brought back ("Geri al"). A customer's answer is never rewritten; it is
 * approved or hidden (moderation). The storefront reads questions without
 * a cache, so a change shows on the next page view.
 */

type Container = Pick<MedusaContainer, "resolve">

const qaOf = (container: Container) => container.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)

export interface AddShopQuestionInput {
  product_id: string
  question: string
  answer: string
  user_id: string
}

const addShopQuestionStep = createStep(
  "product-question-add-shop",
  async (input: AddShopQuestionInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: ["id"],
      filters: { id: input.product_id },
    })
    if (data.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
    }
    const { shopName } = await brandOf(container)
    const added = await qaOf(container).addShopQuestions({
      product_id: input.product_id,
      user_id: input.user_id,
      author_name: shopName,
      items: [{ question: input.question, answer: input.answer }],
    })
    return new StepResponse({ id: added.question_ids[0] ?? "" }, added)
  },
  async (added, { container }) => {
    if (added) {
      await qaOf(container).removeShopQuestions(added)
    }
  }
)

/** "Soru ekle" on the product page: one question with its answer, in the shop's name. */
export const addShopQuestionWorkflow = createWorkflow(
  "product-question-add-shop",
  (input: AddShopQuestionInput) => new WorkflowResponse(addShopQuestionStep(input))
)

export interface EditQuestionInput {
  id: string
  body?: string | undefined
  /** The shop's answer: written or replaced; null removes it; left out, untouched. */
  answer?: string | null | undefined
  user_id: string
}

const editQuestionStep = createStep(
  "product-question-edit",
  async (input: EditQuestionInput, { container }) => {
    const { shopName } = await brandOf(container)
    const undo = await qaOf(container).editQuestion({ ...input, author_name: shopName })
    return new StepResponse({ id: input.id }, undo)
  },
  async (undo: QuestionEditUndo | undefined, { container }) => {
    if (undo) {
      await qaOf(container).undoEdit(undo)
    }
  }
)

export const editQuestionWorkflow = createWorkflow(
  "product-question-edit",
  (input: EditQuestionInput) => new WorkflowResponse(editQuestionStep(input))
)

const removeQuestionStep = createStep(
  "product-question-remove",
  async (input: { id: string }, { container }) => {
    const removed = await qaOf(container).removeQuestion(input.id)
    return new StepResponse(removed, removed.id)
  },
  async (id, { container }) => {
    if (id) {
      await qaOf(container).restoreQuestion(id)
    }
  }
)

/** A question deleted with its answers; "Geri al" restores it (`restoreQuestionWorkflow`). */
export const removeQuestionWorkflow = createWorkflow(
  "product-question-remove",
  (input: { id: string }) => new WorkflowResponse(removeQuestionStep(input))
)

const restoreQuestionStep = createStep(
  "product-question-restore",
  async (input: { id: string }, { container }) => {
    const restored = await qaOf(container).restoreQuestion(input.id)
    return new StepResponse(restored, restored.id)
  },
  async (id, { container }) => {
    if (id) {
      await qaOf(container).removeQuestion(id)
    }
  }
)

export const restoreQuestionWorkflow = createWorkflow(
  "product-question-restore",
  (input: { id: string }) => new WorkflowResponse(restoreQuestionStep(input))
)
