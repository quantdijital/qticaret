import type { AiImageInput, TextConnector } from "./connectors/types"
import { productAttributesOf } from "./product-attributes"
import type { AttributeAllowed } from "./product-attributes"
import { productCardOf } from "./product-card"
import { productFaqOf } from "./product-faq"
import type { FaqAllowed } from "./product-faq"
import type { CardAllowed } from "./product-card"
import { productPicksOf } from "./product-picks"
import type { PickAllowed } from "./product-picks"
import { postDraftOf } from "./post-draft"
import type { PostDraftAllowed } from "./post-draft"
import type { PromptMessages } from "./prompt"
import type { AiTask } from "./registry/tasks"
import { maxTokensOf } from "./run-text"
import type { GatedText, TextTaskResult } from "./run-text"

/**
 * A structured task's call and gate as one step (adr/0071 §8, §9), as
 * `runTextTask` is for a text: the answer is asked for as JSON (the
 * service's JSON mode where its registry entry documents one; otherwise
 * the object is taken out of the text) and read against the closed card
 * schema and the shop's lists. What comes out is the card as JSON text,
 * branded as gated, or the problems with nothing of the answer.
 */
export async function runCardTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: CardAllowed
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  return runStructured(input, (text) => {
    const result = productCardOf(text, input.allowed)
    return "problems" in result ? result : { value: result.card }
  })
}

/**
 * A pick task's call (a product's tags or categories, lib/ai/product-picks.ts):
 * the same JSON call, its answer read against the closed schema and the
 * lists the prompt named; what comes out is the picks as JSON text.
 */
export async function runPickTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: PickAllowed
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  return runStructured(input, (text) => {
    const result = productPicksOf(text, input.allowed)
    return "problems" in result ? result : { value: result.picks }
  })
}

/**
 * An attributes suggestion's call (lib/ai/product-attributes.ts): the same
 * JSON call, with the product's picture where the service can see it; its
 * values read one by one against the empty attributes the prompt named.
 */
export async function runAttributesTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: AttributeAllowed
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  return runStructured(input, (text) => {
    const result = productAttributesOf(text, input.allowed)
    return "problems" in result ? result : { value: result.suggestions }
  })
}

/**
 * A FAQ draft's call (lib/ai/product-faq.ts): the same JSON call; each item
 * read and gated on its own, against the questions the product already has.
 */
export async function runFaqTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: FaqAllowed
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  return runStructured(input, (text) => {
    const result = productFaqOf(text, input.allowed)
    return "problems" in result ? result : { value: result.suggestions }
  })
}

/**
 * A blog post draft's call (lib/ai/post-draft.ts): the same JSON call; every
 * heading and paragraph gated on its own, the links held against the list
 * the prompt named.
 */
export async function runPostDraftTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: PostDraftAllowed
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  return runStructured(input, (text) => {
    const result = postDraftOf(text, input.allowed)
    return "problems" in result ? result : { value: result.draft }
  })
}

async function runStructured(
  input: {
    connector: TextConnector
    task: AiTask
    prompt: PromptMessages
    images?: readonly AiImageInput[]
    signal?: AbortSignal
  },
  read: (text: string) => { value: unknown } | { problems: string[] }
): Promise<TextTaskResult> {
  const { connector, task, prompt } = input
  const answer = await connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: maxTokensOf(task),
    json: true,
    ...(task.temperature === undefined ? {} : { temperature: task.temperature }),
    ...(input.images === undefined ? {} : { images: input.images }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  const result = read(answer.text)
  if ("problems" in result) {
    return { status: "refused", problems: result.problems, usage: answer.usage, correction: null }
  }
  const text = JSON.stringify(result.value) as GatedText
  // A card is one answer, never candidates, and is not corrected (its schema refuses, not its words)
  return { status: "succeeded", text, candidates: [text], usage: answer.usage, correction: null }
}
