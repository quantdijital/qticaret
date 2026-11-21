import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { AI_ENTITY_ID_PREFIX, entityFacts } from "../../../lib/ai/facts"
import type { AiEntityType } from "../../../lib/ai/facts"
import { productCardFacts } from "../../../lib/ai/facts/product-card"
import {
  productAttributeFacts,
  sentWholeAttributes,
} from "../../../lib/ai/facts/product-attributes"
import { productFaqFacts } from "../../../lib/ai/facts/product-faq"
import { productPickFacts, sentWhole } from "../../../lib/ai/facts/product-picks"
import { craftText, guidanceText, readGuidance, takesGuidance } from "../../../lib/ai/guidance"
import type { AiGuidanceSettings } from "../../../modules/platform-settings/sections/ai-guidance"
import { systemOf } from "../../../lib/ai/instructions"
import type { AttributeAllowed } from "../../../lib/ai/product-attributes"
import type { CardAllowed } from "../../../lib/ai/product-card"
import type { FaqAllowed } from "../../../lib/ai/product-faq"
import type { PostDraftAllowed } from "../../../lib/ai/post-draft"
import { isPickTask } from "../../../lib/ai/product-picks"
import type { PickAllowed } from "../../../lib/ai/product-picks"
import { buildPrompt } from "../../../lib/ai/prompt"
import { factLengthsOf, findAiTask, isTaskEntity } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"
import type { CampaignAllowed } from "../../../lib/ai/campaign-text"
import { isCampaignTask } from "../../../lib/ai/run-campaign"
import { campaignInput } from "./campaign-input"
import { postDraftInput } from "./post-draft-input"

export { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
export type { AiEntityType } from "../../../lib/ai/facts"

export interface TaskInputInput {
  task: string
  option?: string | null | undefined
  entity_type: AiEntityType
  entity_id: string
  /** A product card's template (Aşama 6): whose attributes it may fill; read on the server. */
  template_id?: string | null | undefined
  /** Which writing guidance goes in; the shop's stored one when left out. */
  guidance?: GuidanceSource | undefined
  /** A `photo` task's picture, found where its service was chosen (select-service); none: text only. */
  image_file_id?: string | null | undefined
}

/**
 * The writing guidance a call is built with (adr/0074 §2): the shop's
 * stored setting (every suggestion), none, or settings not yet saved that
 * the settings page's "Dene" sent, held by the section's own schema
 * before they reach here (`api/admin/ai/validators.ts`).
 */
export type GuidanceSource =
  { use: "stored" } | { use: "none" } | { use: "given"; settings: AiGuidanceSettings }

interface Guided {
  guidance: string | null
  craft: string | null
}

/**
 * The guidance part of a task's system message and the owner's craft in
 * its default's place (adr/0074 §2, §3), or null for either: none set, or
 * a task that takes none. "Dene"'s settings without a craft for the task
 * try the stored one, so a try shows what the shop's tasks really use.
 */
async function guidanceOf(
  container: Parameters<typeof readGuidance>[0],
  task: AiTask,
  source: GuidanceSource | undefined
): Promise<Guided> {
  if (!takesGuidance(task) || source?.use === "none") {
    return { guidance: null, craft: null }
  }
  if (source?.use !== "given") {
    const stored = await readGuidance(container)
    return { guidance: guidanceText(stored, task.id), craft: craftText(stored, task.id) }
  }
  const given = source.settings
  const entry = Object.hasOwn(given.tasks, task.id) ? given.tasks[task.id] : undefined
  const craft =
    entry?.craft === undefined
      ? craftText(await readGuidance(container), task.id)
      : craftText(given, task.id)
  return { guidance: guidanceText(given, task.id), craft }
}

export interface TaskInput {
  system: string
  data: string
  image_file_id: string | null
  /**
   * A product card's lists (the only categories and attributes its answer
   * may name), or a pick task's list (the only tags or categories).
   */
  allowed: CardAllowed | PickAllowed | AttributeAllowed | FaqAllowed | PostDraftAllowed | null
  /** A bulk message's limits: the figures its data holds and an SMS's end (steps/campaign-input.ts). */
  campaign?: CampaignAllowed | null
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
 * A pick task (a product's tags or categories): the product's own facts,
 * read as any product task's, after the shop's list it may pick from (first,
 * so a block too long gives up the product's long text, never the list).
 */
async function pickInput(
  container: Parameters<typeof productPickFacts>[0],
  task: AiTask,
  instruction: string,
  input: TaskInputInput
): Promise<TaskInput> {
  if (!isPickTask(task)) {
    throw aiValidationError("ai.unknown_task")
  }
  const record = await entityFacts(container, input.entity_type, input.entity_id)
  const picks = await productPickFacts(container, task.gate, input.entity_id)
  // Nothing to pick from: turned away before any quota is claimed (a tag may still be new)
  if (task.gate === "product_category" && picks.allowed.choices.length === 0) {
    throw aiValidationError("ai.no_choices")
  }
  const prompt = buildPrompt({
    instruction,
    fields: { ...picks.fields, ...record.fields },
    maxLengths: { ...factLengthsOf(task, record.maxLengths), ...picks.maxLengths },
    maxItems: picks.maxItems,
  })
  // A list the block could not hold whole is not sent (#251 D2): no call, no quota
  if (!sentWhole(prompt.data, picks)) {
    throw aiValidationError("ai.choices_too_long")
  }
  return { system: prompt.system, data: prompt.data, image_file_id: null, allowed: picks.allowed }
}

/**
 * An attributes suggestion: the product's own facts after the empty public
 * attributes it may fill (first, so a block too long gives up the long
 * text, never the list); the picture by its file id when the chosen service
 * reads it. Nothing empty to fill: turned away before any quota is claimed.
 */
async function attributesInput(
  container: Parameters<typeof productAttributeFacts>[0],
  task: AiTask,
  instruction: string,
  input: TaskInputInput
): Promise<TaskInput> {
  const record = await entityFacts(container, input.entity_type, input.entity_id)
  const attributes = await productAttributeFacts(container, input.entity_id)
  if (attributes.allowed.attributes.length === 0) {
    throw aiValidationError("ai.no_empty_attributes")
  }
  const prompt = buildPrompt({
    instruction,
    fields: { ...attributes.fields, ...record.fields },
    maxLengths: { ...factLengthsOf(task, record.maxLengths), ...attributes.maxLengths },
    maxItems: attributes.maxItems,
  })
  if (!sentWholeAttributes(prompt.data, attributes)) {
    throw aiValidationError("ai.choices_too_long")
  }
  return {
    system: prompt.system,
    data: prompt.data,
    image_file_id: input.image_file_id ?? null,
    allowed: attributes.allowed,
  }
}

/**
 * A FAQ draft: the product's own facts, then its short description and the
 * questions already published on its page (their authors' names masked),
 * held on the server too (`allowed`) so one asked again drops.
 */
async function faqInput(
  container: Parameters<typeof productFaqFacts>[0],
  task: AiTask,
  instruction: string,
  input: TaskInputInput
): Promise<TaskInput> {
  const record = await entityFacts(container, input.entity_type, input.entity_id)
  const faq = await productFaqFacts(container, input.entity_id)
  const prompt = buildPrompt({
    instruction,
    fields: { ...record.fields, ...faq.fields },
    maxLengths: { ...factLengthsOf(task, record.maxLengths), ...faq.maxLengths },
    maxItems: faq.maxItems,
  })
  return { system: prompt.system, data: prompt.data, image_file_id: null, allowed: faq.allowed }
}

/**
 * The call's two messages (adr/0071 §8.3, §9; adr/0074 §1): the task's
 * instruction with the shop's writing guidance in its labelled place (a
 * text task only), and the record read on the server (no text of it is
 * taken from the client), each value filtered of personal data and
 * clipped. Nothing to undo.
 */
export const taskInputStep = createStep(
  "ai-task-input",
  async (input: TaskInputInput, { container }) => {
    const task = findAiTask(input.task)
    // The shop's writing guidance, a setting (adr/0074 §2): read here, never from the ask
    const guided = task ? await guidanceOf(container, task, input.guidance) : null
    const instruction = task
      ? systemOf(task, input.option, input.entity_type, guided?.guidance, guided?.craft)
      : null
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
    if (isPickTask(task)) {
      return new StepResponse(await pickInput(container, task, instruction, input))
    }
    if (task.gate === "product_attributes") {
      return new StepResponse(await attributesInput(container, task, instruction, input))
    }
    if (task.gate === "product_faq") {
      return new StepResponse(await faqInput(container, task, instruction, input))
    }
    if (isCampaignTask(task)) {
      const campaign = await campaignInput(container, task, instruction, input.entity_id)
      return new StepResponse<TaskInput>({ ...campaign, image_file_id: null, allowed: null })
    }
    if (task.gate === "post_draft") {
      const draft = await postDraftInput(container, task, instruction, input)
      return new StepResponse<TaskInput>({ ...draft, image_file_id: null })
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
