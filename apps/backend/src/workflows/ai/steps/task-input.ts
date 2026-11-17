import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { instructionOf } from "../../../lib/ai/instructions"
import { buildPrompt } from "../../../lib/ai/prompt"
import type { PromptValue } from "../../../lib/ai/prompt"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import { plainText } from "../../../lib/seo/resolve"
import { brandOf } from "../../messaging/brand"
import { textOf } from "../../seo/highlight"
import type { HighlightValue } from "../../seo/highlight"

/** The kinds of record a suggestion can be asked for; categories and pages come with their tasks. */
export const AI_ENTITY_TYPES = ["product"] as const
export type AiEntityType = (typeof AI_ENTITY_TYPES)[number]

export interface TaskInputInput {
  task: string
  option?: string | null | undefined
  entity_type: AiEntityType
  entity_id: string
}

interface ProductRow {
  title: string
  subtitle?: string | null
  description?: string | null
  brand?: { name: string } | null
  categories?: ({ name: string } | null)[] | null
  attribute_values?: (HighlightValue | null)[] | null
}

/**
 * What may leave the shop of a product (adr/0071 §10): its own published
 * fields and public attributes and the shop's name; nothing of a customer,
 * an order or a staff member, and no attribute the shop keeps to itself.
 */
async function productFields(
  container: Pick<MedusaContainer, "resolve">,
  productId: string
): Promise<Record<string, PromptValue>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "title",
      "subtitle",
      "description",
      "brand.name",
      "categories.name",
      "attribute_values.*",
      "attribute_values.definition.*",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw aiValidationError("ai.unknown_entity")
  }
  return {
    name: product.title,
    subtitle: product.subtitle ?? null,
    brand: product.brand?.name ?? null,
    category: product.categories?.find((each) => each !== null)?.name ?? null,
    attributes: (product.attribute_values ?? []).flatMap((value) => {
      const text = value && value.definition?.is_public !== false ? textOf(value) : ""
      const label = value?.definition?.label
      return text && label ? [{ label, value: text }] : []
    }),
    description: product.description ? plainText(product.description) : null,
    shop: (await brandOf(container)).shopName,
  }
}

/**
 * The call's two messages (adr/0071 §8.3, §9): the task's fixed
 * instruction, and the record read on the server (no text is taken from
 * the client), each value filtered of personal data and clipped. Nothing
 * to undo.
 */
export const taskInputStep = createStep(
  "ai-task-input",
  async (input: TaskInputInput, { container }) => {
    const task = findAiTask(input.task)
    const instruction = task ? instructionOf(task, input.option) : null
    if (!task || instruction === null) {
      throw aiValidationError("ai.unknown_task")
    }
    const fields = await productFields(container, input.entity_id)
    const prompt = buildPrompt({ instruction, fields })
    return new StepResponse({ system: prompt.system, data: prompt.data })
  }
)
