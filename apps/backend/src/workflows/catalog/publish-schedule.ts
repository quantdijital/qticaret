import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  scheduleOf,
  scheduleProblem,
  withSchedule,
  withoutSchedule,
} from "../../lib/catalog/publish-schedule"
import type { Metadata, PublishSchedule } from "../../lib/catalog/publish-schedule"
import { ValidationError } from "../../lib/errors"

export interface SetPublishScheduleInput {
  product_id: string
  /** The planned moment (ISO 8601); null cancels the plan. */
  publish_at: string | null
}

interface SchedulePlan {
  product_id: string
  metadata: Metadata
}

/**
 * Reads the product and works out its metadata with the plan: only a
 * draft is planned, for a moment ahead of now and within a year; a
 * published product's leftover plan may always be cancelled.
 */
export const planPublishScheduleStep = createStep(
  "catalog-plan-publish-schedule",
  async (input: SetPublishScheduleInput, { container }) => {
    const [product] = await container
      .resolve(Modules.PRODUCT)
      .listProducts({ id: input.product_id }, { select: ["id", "status", "metadata"], take: 1 })
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "errors.not_found")
    }
    if (input.publish_at !== null) {
      if (product.status !== "draft") {
        throw new ValidationError("publish_schedule.not_draft", { field: "publish_at" })
      }
      const problem = scheduleProblem(input.publish_at)
      if (problem) {
        throw new ValidationError(`publish_schedule.${problem}`, { field: "publish_at" })
      }
    }
    const metadata = (product.metadata ?? {}) as Metadata
    return new StepResponse<SchedulePlan>({
      product_id: product.id,
      metadata:
        input.publish_at === null
          ? withoutSchedule(metadata)
          : withSchedule(metadata, input.publish_at),
    })
  }
)

/**
 * A draft's planned publish set or cancelled (S2, docs/06 "Ürün
 * sayfası"), written through Medusa's own product update so its hooks
 * run and the write is undone with the workflow. Answers with the plan
 * as stored.
 */
export const setPublishScheduleWorkflow = createWorkflow(
  "catalog-set-publish-schedule",
  (input: SetPublishScheduleInput) => {
    const plan = planPublishScheduleStep(input)
    updateProductsWorkflow.runAsStep({
      input: transform({ plan }, ({ plan }) => ({
        selector: { id: plan.product_id },
        update: { metadata: plan.metadata },
      })),
    })
    const schedule = transform({ plan }, ({ plan }): PublishSchedule => scheduleOf(plan.metadata))
    return new WorkflowResponse(schedule)
  }
)
