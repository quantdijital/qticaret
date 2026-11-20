import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { AI_ENTITY_ID_PREFIX, entityFacts } from "../../../lib/ai/facts"
import type { AiEntityType } from "../../../lib/ai/facts"
import { productCardFacts } from "../../../lib/ai/facts/product-card"
import { systemOf } from "../../../lib/ai/instructions"
import type { CardAllowed } from "../../../lib/ai/product-card"
import { buildPrompt } from "../../../lib/ai/prompt"
import { factLengthsOf, findAiTask, isTaskEntity } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"

export { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
export type { AiEntityType } from "../../../lib/ai/facts"

export interface TaskInputInput {
  task: string
  option?: string | null | undefined
  entity_type: AiEntityType
  entity_id: string
  /** A product card's template (Aşama 6): whose attributes it may fill; read on the server. */
  template_id?: string | null | undefined
}

export interface TaskInput {
  system: string
  data: string
  image_file_id: string | null
  /** A product card's lists: the only categories and attributes its answer may name. */
  allowed: CardAllowed | null
}

/** A product card from a photo: the shop's lists beside the picture, nothing of the image record. */
async function cardInput(
  container: Parameters<typeof productCardFacts>[0],
  task: AiTask,
  input: TaskInputInput
): Promise<TaskInput> {
  const instruction = systemOf(task, input.option)
  if (instruction === null) {
    throw aiValidationError("ai.unknown_task")
  }
  // Checked here too: the workflow may be run without the route's validator
  if (!input.entity_id.startsWith(`${AI_ENTITY_ID_PREFIX.media}_`)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const facts = await productCardFacts(container, input.entity_id, input.template_id)
  const prompt = buildPrompt({
    instruction,
    fields: facts.fields,
    maxLengths: facts.maxLengths,
    maxItems: facts.maxItems,
  })
  return {
    system: prompt.system,
    data: prompt.data,
    image_file_id: facts.image.file_id,
    allowed: facts.allowed,
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
    const instruction = task ? systemOf(task, input.option, input.entity_type) : null
    if (!task || instruction === null) {
      throw aiValidationError("ai.unknown_task")
    }
    // A task for one kind of record only (a product's description) is asked for nothing else
    if (!isTaskEntity(task, input.entity_type)) {
      throw aiValidationError("ai.unknown_entity")
    }
    if (task.gate === "product_card") {
      return new StepResponse(await cardInput(container, task, input))
    }
    // Read by its type and id alone (lib/ai/facts): the record's text never comes from the client
    const { fields, maxLengths, image } = await entityFacts(
      container,
      input.entity_type,
      input.entity_id,
      task.reader
    )
    // A vision task reads a picture: a record with none is turned away before any quota is claimed
    if (task.capability === "vision" && image === null) {
      throw aiValidationError("ai.input_unsupported")
    }
    const prompt = buildPrompt({
      instruction,
      fields,
      maxLengths: factLengthsOf(task, maxLengths),
    })
    // The picture goes by its file id alone; its bytes are read in the call step, never kept here
    const result: TaskInput = {
      system: prompt.system,
      data: prompt.data,
      image_file_id: task.capability === "vision" ? (image?.file_id ?? null) : null,
      allowed: null,
    }
    return new StepResponse(result)
  }
)
