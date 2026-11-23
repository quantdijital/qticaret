import type { AiUsage, TextConnector } from "../connectors/types"
import { SEARCH_INTENT_TASK } from "../registry/search-tasks"
import { searchIntentPrompt, searchTextOut } from "./prompt"
import { readSearchAnswer } from "./read"
import type { DroppedPart, SearchFilter, SearchLists } from "./types"

/**
 * The search intent's call and its reading as one function (adr/0071 §8,
 * §9; adr/0077 §7), as `runTextTask` is for a suggestion: the answer is
 * asked for as JSON and read by `readSearchAnswer` alone, so nothing of
 * it but an accepted filter leaves here. A failed call throws the
 * connector's error. No correction call: an answer that is no object of
 * the schema is no search, and the shopper's sentence is searched as it is.
 */

export type SearchIntentResult =
  | { status: "succeeded"; filter: SearchFilter; dropped: DroppedPart[]; usage: AiUsage }
  | { status: "refused"; usage: AiUsage }

export async function runSearchIntent(input: {
  connector: TextConnector
  text: string
  lists: SearchLists
  signal?: AbortSignal
}): Promise<SearchIntentResult> {
  const task = SEARCH_INTENT_TASK
  const prompt = searchIntentPrompt(input.text, input.lists)
  const answer = await input.connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: task.maxTokens ?? task.maxLength,
    json: true,
    ...(task.temperature === undefined ? {} : { temperature: task.temperature }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  // Read against the sentence as the service saw it: personal data out, so `q` cannot bring it back
  const read = readSearchAnswer(answer.text, input.lists, searchTextOut(input.text))
  return read === null
    ? { status: "refused", usage: answer.usage }
    : { status: "succeeded", filter: read.filter, dropped: read.dropped, usage: answer.usage }
}
