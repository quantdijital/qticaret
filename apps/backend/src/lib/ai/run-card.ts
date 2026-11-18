import type { AiImageInput, TextConnector } from "./connectors/types"
import { productCardOf } from "./product-card"
import type { CardAllowed } from "./product-card"
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
  const { connector, task, prompt } = input
  const answer = await connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: maxTokensOf(task),
    json: true,
    ...(input.images === undefined ? {} : { images: input.images }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  const result = productCardOf(answer.text, input.allowed)
  return "problems" in result
    ? { status: "refused", problems: result.problems, usage: answer.usage }
    : {
        status: "succeeded",
        text: JSON.stringify(result.card) as GatedText,
        usage: answer.usage,
      }
}
