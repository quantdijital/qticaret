import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { estimateCost } from "../../../lib/ai/cost"
import { ASSISTANT_TASK } from "../../../lib/ai/registry/assistant-tasks"
import { findAiService } from "../../../lib/ai/registry/services"
import { logger } from "../../../lib/logging"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import type { CallRecord } from "./assistant-turn"
import { usageCredits } from "./record-usage"

/** What the usage row names a turn's tools as: `entity_type`, holding no record. */
export const ASSISTANT_TOOLS_ENTITY = "assistant_tools"
const MAX_TOOL_SUMMARY = 200

/** The tools run and refused, by name and count (`explain_screen:1,find_screen:2`); no argument. */
export function toolSummary(counts: Readonly<Record<string, number>>): string | null {
  const text = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name}:${String(count)}`)
    .join(",")
  return text === "" ? null : text.slice(0, MAX_TOOL_SUMMARY)
}

export interface AssistantRecordInput {
  user_id: string
  service: string
  funding: "own_key" | "platform_credit"
  model: string
  calls: CallRecord[]
  tool_counts: Record<string, number>
  /** Why the turn did not answer, as a code of ours; null when it did. */
  outcome: string
}

/**
 * Each model call of the turn as one `ai_usage` row (adr/0079 §8): task
 * `assistant`, counts and codes, the turn's tools by name and count on
 * its last row; never a text. And the turn's `ai.assistant_turn` log
 * line: the same, no prompt, reply, tool result or key (§13). Not undone:
 * a call made stays recorded.
 */
export const assistantRecordStep = createStep(
  "ai-assistant-record",
  async (input: AssistantRecordInput, { container }) => {
    const ai = container.resolve<AiModuleService>(AI_MODULE)
    const service = findAiService(input.service)
    const tools = toolSummary(input.tool_counts)
    const ids: string[] = []
    for (const [index, call] of input.calls.entries()) {
      const last = index === input.calls.length - 1
      const cost = service
        ? estimateCost(service, ASSISTANT_TASK.capability, {
            ...(call.input_tokens === null ? {} : { inputTokens: call.input_tokens }),
            ...(call.output_tokens === null ? {} : { outputTokens: call.output_tokens }),
          })
        : null
      ids.push(
        await ai.recordUsage({
          task: ASSISTANT_TASK.id,
          capability: ASSISTANT_TASK.capability,
          service: input.service,
          model: input.model,
          funding: input.funding,
          status: call.status,
          input_tokens: call.input_tokens,
          output_tokens: call.output_tokens,
          estimated_cost_micros: cost?.micros ?? null,
          currency: cost?.currency ?? null,
          credits: usageCredits(input.funding, call.credits),
          entity_type: last && tools !== null ? ASSISTANT_TOOLS_ENTITY : null,
          entity_id: last ? tools : null,
          suggestion_id: null,
          duration_ms: call.duration_ms,
          error_code: call.error_code,
          requested_by: input.user_id,
        })
      )
    }
    logger.info({
      event: "ai.assistant_turn",
      service: input.service,
      funding: input.funding,
      outcome: input.outcome,
      model_calls: input.calls.length,
      tools,
      duration_ms: input.calls.reduce((sum, call) => sum + call.duration_ms, 0),
      error_codes: input.calls.flatMap((call) => (call.error_code ? [call.error_code] : [])),
    })
    return new StepResponse({ usage_ids: ids })
  }
)
