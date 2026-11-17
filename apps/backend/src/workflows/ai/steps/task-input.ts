import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { entityFacts } from "../../../lib/ai/facts"
import type { AiEntityType } from "../../../lib/ai/facts"
import { instructionOf } from "../../../lib/ai/instructions"
import { buildPrompt } from "../../../lib/ai/prompt"
import { findAiTask } from "../../../lib/ai/registry/tasks"

export { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
export type { AiEntityType } from "../../../lib/ai/facts"

export interface TaskInputInput {
  task: string
  option?: string | null | undefined
  entity_type: AiEntityType
  entity_id: string
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
    const instruction = task ? instructionOf(task, input.option, input.entity_type) : null
    if (!task || instruction === null) {
      throw aiValidationError("ai.unknown_task")
    }
    // Read by its type and id alone (lib/ai/facts): the record's text never comes from the client
    const { fields, maxLengths } = await entityFacts(container, input.entity_type, input.entity_id)
    const prompt = buildPrompt({ instruction, fields, maxLengths })
    return new StepResponse({ system: prompt.system, data: prompt.data })
  }
)
