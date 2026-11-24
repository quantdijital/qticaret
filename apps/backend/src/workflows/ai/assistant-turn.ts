import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { AssistantLocale } from "../../lib/ai/assistant/tools"
import { assistantRecordStep } from "./steps/assistant-record"
import { assistantAccessStep, assistantRunStep, assistantSaveStep } from "./steps/assistant-turn"

export interface AssistantTurnInput {
  user_id: string
  /** The conversation to go on with; never its messages (adr/0079 §7). */
  conversation_id?: string | null | undefined
  /** The person's new message, as validated by the route. */
  message: string
  locale?: AssistantLocale | undefined
  /** The screen open in the panel: a key of the map, a record's type and id at most. */
  screen?: { key: string; record?: { type: string; id: string } | undefined } | null | undefined
  service?: string | null | undefined
}

/**
 * One turn of the panel assistant (adr/0079 §2, §8): the person's role,
 * the shop's flag and a service whose tool calling is verified; the loop
 * with each model call claimed against the day's ceilings and the month's
 * credits; the conversation kept on the server (put back as it was if a
 * later step fails); every call recorded without its text. A turn that
 * did not answer comes back with its error, raised by the route once the
 * calls are recorded. Neither `store` nor a retention may be turned on:
 * the person's words must not be kept in `workflow_execution`.
 */
export const assistantTurnWorkflow = createWorkflow(
  "ai-assistant-turn",
  (input: AssistantTurnInput) => {
    const access = assistantAccessStep(
      transform({ input }, ({ input }) => ({
        user_id: input.user_id,
        service: input.service ?? null,
      }))
    )
    const run = assistantRunStep(
      transform({ input, access }, ({ input, access }) => ({
        user_id: input.user_id,
        role: access.role,
        service: access.service,
        features: access.features,
        conversation_id: input.conversation_id ?? null,
        message: input.message,
        locale: input.locale ?? "tr",
        screen: input.screen ?? null,
      }))
    )
    assistantSaveStep(
      transform({ run }, ({ run }) => ({
        conversation_id: run.conversation_id,
        record: run.record,
      }))
    )
    assistantRecordStep(
      transform({ input, access, run }, ({ input, access, run }) => ({
        user_id: input.user_id,
        service: access.service,
        funding: access.funding,
        model: run.model,
        calls: run.calls,
        tool_counts: run.tool_counts,
        outcome: run.error === null ? "answered" : run.error.code,
      }))
    )
    return new WorkflowResponse(
      transform({ access, run }, ({ access, run }) => ({
        service: access.service,
        conversation_id: run.conversation_id,
        error: run.error,
        messages:
          run.reply === null
            ? []
            : [
                { role: "user" as const, text: run.user_text },
                {
                  role: "assistant" as const,
                  text: run.reply.text,
                  screens: run.reply.screens,
                },
              ],
      }))
    )
  }
)
