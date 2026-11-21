import { campaignEmailOf, campaignSmsOf } from "./campaign-text"
import type { CampaignAllowed } from "./campaign-text"
import type { TextConnector } from "./connectors/types"
import type { PromptMessages } from "./prompt"
import type { AiTask } from "./registry/tasks"
import { maxTokensOf } from "./run-text"
import type { GatedText, TextTaskResult } from "./run-text"

/** Whether a task is a bulk message's words (registry/campaign-tasks.ts). */
export const isCampaignTask = (task: Pick<AiTask, "gate">): boolean =>
  task.gate === "campaign_email" || task.gate === "campaign_sms"

/**
 * A bulk message's call and gate as one step (adr/0071 §8, §9), as
 * `runCardTask` is for a structured answer: asked as JSON, read against
 * its closed schema (lib/ai/campaign-text.ts). An e-mail comes out as one
 * JSON text (its subjects, preview line and body); a text as candidates,
 * one per SMS, so the one picked is recorded (adr/0074 §4). Not
 * corrected: the schema refuses, a second call would cost as the first.
 */
export async function runCampaignTask(input: {
  connector: TextConnector
  task: AiTask
  prompt: PromptMessages
  allowed: CampaignAllowed
  signal?: AbortSignal
}): Promise<TextTaskResult> {
  const { connector, task, prompt, allowed } = input
  const answer = await connector.complete({
    system: prompt.system,
    data: prompt.data,
    maxTokens: maxTokensOf(task),
    json: true,
    ...(task.temperature === undefined ? {} : { temperature: task.temperature }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  })
  const refused = (problems: string[]): TextTaskResult => ({
    status: "refused",
    problems,
    usage: answer.usage,
    correction: null,
  })
  if (task.gate === "campaign_sms") {
    const result = campaignSmsOf(answer.text, allowed)
    if ("problems" in result) {
      return refused(result.problems)
    }
    const candidates = result.texts as GatedText[]
    const [text] = candidates as [GatedText, ...GatedText[]]
    return { status: "succeeded", text, candidates, usage: answer.usage, correction: null }
  }
  const result = campaignEmailOf(answer.text, allowed)
  if ("problems" in result) {
    return refused(result.problems)
  }
  const text = JSON.stringify(result.email) as GatedText
  return { status: "succeeded", text, candidates: [text], usage: answer.usage, correction: null }
}
