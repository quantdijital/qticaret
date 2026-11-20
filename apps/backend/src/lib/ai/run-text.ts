import type { AiImageInput, AiUsage, TextConnector } from "./connectors/types"
import { correctionNote, withCorrection } from "./correction"
import type { RefusedCandidate } from "./correction"
import { suggestionCandidates, suggestionProblems } from "./gate"
import type { PromptMessages } from "./prompt"
import type { AiTask } from "./registry/tasks"

/**
 * A text task's call, cleaning and gate as one step that cannot be split
 * (adr/0071 §8, §9): the only way to a suggestion is through here, and
 * what comes out is either texts that passed the gate (branded, so no
 * other code can make one) or the gate's problems with no text at all.
 * A short text comes as candidates, each gated on its own; when none
 * passes, the service is asked once more with the gate's reasons
 * (adr/0074 §4), if the caller allows it.
 */

declare const gated: unique symbol

/** A suggestion's text that passed the output gate; only `runTextTask` makes one. */
export type GatedText = string & { readonly [gated]: true }

/** One call's gated answer. */
export type TextAttempt =
  | { status: "succeeded"; candidates: GatedText[]; usage: AiUsage; duration_ms: number }
  | { status: "refused"; problems: string[]; usage: AiUsage; duration_ms: number }

/** The correction call, when one was made: its answer, or how it failed. */
export type CorrectionAttempt =
  | { status: "answered"; attempt: TextAttempt }
  | { status: "failed"; error: unknown; duration_ms: number }

/** The suggestion to offer: the first call's, or the correction's when the first had none. */
export type TextTaskResult = (
  | { status: "succeeded"; text: GatedText; candidates: GatedText[] }
  | { status: "refused"; problems: string[] }
) & {
  /** The first call's usage; the correction's is its own. */
  usage: AiUsage
  correction: CorrectionAttempt | null
}

/** Room for the longest answer: every candidate at its longest, a token at least a character. */
export const maxTokensOf = (task: AiTask): number =>
  Math.max(64, task.maxLength * 2 * Math.max(1, task.candidates ?? 1))

interface CallInput {
  connector: TextConnector
  task: AiTask
  /** A vision task's picture, prepared (lib/ai/image-input.ts). */
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}

/** One call and its gate: the candidates that pass, or every refused one's problems. */
async function attempt(
  input: CallInput,
  prompt: PromptMessages
): Promise<{ result: TextAttempt; refused: RefusedCandidate[] }> {
  const { connector, task } = input
  const started = Date.now()
  const answer = await connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: maxTokensOf(task),
    ...(task.temperature === undefined ? {} : { temperature: task.temperature }),
    ...(input.images === undefined ? {} : { images: input.images }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  const passed: GatedText[] = []
  const refused: RefusedCandidate[] = []
  const candidates = suggestionCandidates(task, answer.text)
  for (const text of candidates.length > 0 ? candidates : [""]) {
    const problems = suggestionProblems(task, text, prompt.data)
    if (problems.length === 0) {
      passed.push(text as GatedText)
    } else {
      refused.push({ text, problems })
    }
  }
  const duration_ms = Date.now() - started
  const result: TextAttempt =
    passed.length > 0
      ? { status: "succeeded", candidates: passed, usage: answer.usage, duration_ms }
      : {
          status: "refused",
          problems: [...new Set(refused.flatMap((each) => each.problems))],
          usage: answer.usage,
          duration_ms,
        }
  return { result, refused }
}

/**
 * Asks the connector, takes markup out of its answer and checks each
 * candidate against the task's gate. A failed first call throws the
 * connector's error. When nothing passed and `mayCorrect` says yes (it
 * claims the second call's place under the day's ceiling), the service
 * is asked once more with the reasons; that call's failure is returned,
 * never thrown, and the first refusal stands.
 */
export async function runTextTask(
  input: CallInput & {
    prompt: PromptMessages
    mayCorrect?: () => Promise<boolean>
  }
): Promise<TextTaskResult> {
  const first = await attempt(input, input.prompt)
  if (first.result.status === "succeeded") {
    const [text] = first.result.candidates as [GatedText, ...GatedText[]]
    return {
      status: "succeeded",
      text,
      candidates: first.result.candidates,
      usage: first.result.usage,
      correction: null,
    }
  }
  const refusal = {
    status: "refused" as const,
    problems: first.result.problems,
    usage: first.result.usage,
  }
  if (!input.mayCorrect || !(await input.mayCorrect())) {
    return { ...refusal, correction: null }
  }
  const note = correctionNote(input.task, first.refused, input.prompt.data)
  const started = Date.now()
  let second: TextAttempt
  try {
    second = (
      await attempt(input, {
        system: withCorrection(input.prompt.system, note),
        data: input.prompt.data,
      })
    ).result
  } catch (error) {
    const failed = { status: "failed" as const, error, duration_ms: Date.now() - started }
    return { ...refusal, correction: failed }
  }
  const correction = { status: "answered" as const, attempt: second }
  if (second.status === "refused") {
    return { ...refusal, problems: second.problems, correction }
  }
  const [text] = second.candidates as [GatedText, ...GatedText[]]
  return {
    status: "succeeded",
    text,
    candidates: second.candidates,
    usage: first.result.usage,
    correction,
  }
}
