import type { AiImageInput, AiUsage, TextConnector } from "./connectors/types"
import { suggestionProblems, suggestionText } from "./gate"
import type { PromptMessages } from "./prompt"
import type { AiTask } from "./registry/tasks"

/**
 * A text task's call, cleaning and gate as one step that cannot be split
 * (adr/0071 §8, §9): the only way to a suggestion is through here, and
 * what comes out is either a text that passed the gate (branded, so no
 * other code can make one) or the gate's problems with no text at all.
 */

declare const gated: unique symbol

/** A suggestion's text that passed the output gate; only `runTextTask` makes one. */
export type GatedText = string & { readonly [gated]: true }

export type TextTaskResult =
  | { status: "succeeded"; text: GatedText; usage: AiUsage }
  | { status: "refused"; problems: string[]; usage: AiUsage }

/** Room for the longest suggestion: a token is at least a character in the languages served. */
export const maxTokensOf = (task: AiTask): number => Math.max(64, task.maxLength * 2)

/**
 * Asks the connector, takes markup out of its answer and checks the rest
 * against the task's gate. A failed call throws the connector's error.
 */
export async function runTextTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  /** A vision task's picture, prepared (lib/ai/image-input.ts). */
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  const { connector, task, prompt } = input
  const answer = await connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: maxTokensOf(task),
    ...(input.images === undefined ? {} : { images: input.images }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  const text = suggestionText(answer.text)
  const problems = suggestionProblems(task, text)
  return problems.length > 0
    ? { status: "refused", problems, usage: answer.usage }
    : { status: "succeeded", text: text as GatedText, usage: answer.usage }
}
