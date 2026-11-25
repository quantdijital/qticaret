import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import {
  conversationKey,
  conversationStore,
  loadConversation,
  newConversationId,
  saveConversation,
} from "../../../lib/ai/assistant/conversation"
import type { ConversationRecord } from "../../../lib/ai/assistant/conversation"
import { runAssistantLoop } from "../../../lib/ai/assistant/loop"
import type { LoopResult } from "../../../lib/ai/assistant/loop"
import { noReply, replyOf } from "../../../lib/ai/assistant/reply"
import type { Reply } from "../../../lib/ai/assistant/reply"
import { visibleScreens } from "../../../lib/ai/assistant/screens"
import { assistantSystem, screenContextBlock } from "../../../lib/ai/assistant/system"
import { toolsFor } from "../../../lib/ai/assistant/tools"
import type { AssistantLocale } from "../../../lib/ai/assistant/tools"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { textTargetOf, toolConnectorWith } from "../../../lib/ai/connector-of"
import type { ToolConnector } from "../../../lib/ai/connectors/types"
import { aiProviderError, aiValidationError } from "../../../lib/ai/errors"
import type { AiErrorKey } from "../../../lib/ai/errors"
import { failureOf, notTakenByService } from "../../../lib/ai/outcome"
import { ASSISTANT_TASK } from "../../../lib/ai/registry/assistant-tasks"
import { redactPersonalData } from "../../../lib/ai/redact"
import type { StaffRole } from "../../../lib/staff/permissions"
import { claimAssistantCall, releaseAssistantCall } from "./assistant-claims"
import type { AssistantClaim } from "./assistant-claims"
import { transportFor } from "../transport-for"
import type { AiRoute } from "../transport-for"

/**
 * The assistant's turn, step by step (adr/0079 §2, adr/0071 §8): who
 * asks and which service may run it, the loop (each model call claimed
 * first, given back when the service never took it), the conversation
 * kept, the calls recorded. The person's words live in the steps' input
 * only: the workflow is neither stored nor retained.
 */

/** A turn waits for its answer at most this long (adr/0079 §2). */
export const TURN_TIMEOUT_MS = 60_000

// Who asks and which service runs the turn: its own file, here for the workflow
export { assistantAccessStep } from "./assistant-access"

export interface AssistantRunInput {
  user_id: string
  role: StaffRole
  service: string
  /** The turn's operation (the access step's); on credits every model call carries it. */
  operation?: string | null | undefined
  features: string[]
  conversation_id: string | null
  message: string
  locale: AssistantLocale
  screen: { key: string; record?: { type: string; id: string } | undefined } | null
}

/** One model call as recorded: counts and codes, never a text. */
export interface CallRecord {
  status: "succeeded" | "refused" | "failed" | "timeout" | "cancelled"
  input_tokens: number | null
  output_tokens: number | null
  duration_ms: number
  error_code: string | null
}

export interface AssistantRunOutput {
  conversation_id: string
  /** The conversation to keep; null when the turn did not answer. */
  record: ConversationRecord | null
  /** This turn's messages as the panel shows them. */
  reply: Reply | null
  user_text: string
  /** Why the turn did not answer: the route raises it after the calls are recorded. */
  error: { kind: "provider" | "refused"; key: AiErrorKey; code: string } | null
  model: string
  calls: CallRecord[]
  tool_counts: Record<string, number>
}

/** The loop's model calls, as `ai_usage` rows read them. */
function callRecords(loop: LoopResult, reply: Reply | null): CallRecord[] {
  return loop.calls.map((call, index) => {
    const failed = call.error === null ? null : failureOf(call.error)
    const last = index === loop.calls.length - 1
    const refused = last && reply !== null && reply.problems.length > 0
    return {
      status: failed?.status ?? (refused ? "refused" : "succeeded"),
      input_tokens: call.usage.inputTokens ?? null,
      output_tokens: call.usage.outputTokens ?? null,
      duration_ms: call.duration_ms,
      error_code: failed?.code ?? null,
    }
  })
}

/** The person's conversation, the loop and the gated reply; nothing kept yet. */
export const assistantRunStep = createStep(
  "ai-assistant-run",
  async (input: AssistantRunInput, { container }) => {
    const now = Date.now()
    const store = conversationStore()
    const existing =
      input.conversation_id === null
        ? null
        : await loadConversation(store, input.user_id, input.conversation_id, now)
    // A lapsed or unknown conversation starts anew: the panel sees the new id
    const conversationId =
      existing !== null && input.conversation_id !== null
        ? input.conversation_id
        : newConversationId()
    const features = new Set(input.features)
    const screens = visibleScreens(input.role, features)
    const open =
      input.screen !== null && screens.some((each) => each.key === input.screen?.key)
        ? {
            screen: input.screen.key,
            ...(input.screen.record ? { record: input.screen.record } : {}),
          }
        : null
    const userText = redactPersonalData(input.message)
    const base = {
      conversation_id: conversationId,
      record: null,
      reply: null,
      user_text: userText,
      model: textTargetOf(input.service, "text")?.target.model ?? "",
    }
    let route: AiRoute
    try {
      // One transport for the turn: its every model call carries the turn's operation
      route = await transportFor(container, {
        service: input.service,
        capability: "text",
        task: ASSISTANT_TASK.id,
        operation: input.operation,
      })
    } catch (caught) {
      const failure = failureOf(caught)
      const error = { kind: "provider" as const, key: failure.key, code: failure.code }
      return new StepResponse<AssistantRunOutput>({ ...base, error, calls: [], tool_counts: {} })
    }
    base.model = textTargetOf(route.service.id, "text")?.target.model ?? base.model
    // On the platform's credits the month is not claimed (adr/0085 K9)
    const monthly = route.transport.funding === "own_key"
    const inner = toolConnectorWith(route.service.id, route.transport)
    const connector: ToolConnector = {
      converse: (request) => withAiBreaker(input.service, () => inner.converse(request)),
    }
    const claims: AssistantClaim[] = []
    // Set inside the claim: an object, so the check after the loop is not narrowed away
    const refused: { by: "daily_limit" | "credits" | null } = { by: null }
    const loop = await runAssistantLoop({
      connector,
      system: assistantSystem(input.locale),
      screen: screenContextBlock(open),
      history: existing?.messages ?? [],
      message: userText,
      tools: toolsFor(input.role, features),
      context: { role: input.role, locale: input.locale, screens },
      claim: async () => {
        const claimed = await claimAssistantCall(container, input.user_id, new Date(), monthly)
        if (!claimed.ok) {
          refused.by = claimed.reason
          return false
        }
        claims.push(claimed.claim)
        return true
      },
      signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    })
    const lastClaim = claims[claims.length - 1]
    if (loop.status === "failed") {
      const failure = failureOf(loop.error)
      if (lastClaim && notTakenByService(failure.key, failure.code)) {
        await releaseAssistantCall(container, input.user_id, lastClaim)
      }
      const error = { kind: "provider" as const, key: failure.key, code: failure.code }
      return new StepResponse<AssistantRunOutput>({
        ...base,
        error,
        calls: callRecords(loop, null),
        tool_counts: loop.toolCounts,
      })
    }
    if (loop.status !== "answered") {
      const key: AiErrorKey =
        loop.status === "turn_limit"
          ? "ai.assistant_turn_limit"
          : refused.by === "credits"
            ? "ai.credits_exhausted"
            : "ai.assistant_daily_limit"
      return new StepResponse<AssistantRunOutput>({
        ...base,
        error: { kind: "refused", key, code: loop.status },
        calls: callRecords(loop, null),
        tool_counts: loop.toolCounts,
      })
    }
    const reply =
      loop.text === null ? noReply(input.locale) : replyOf(loop.text, screens, input.locale)
    // The reply is kept as the person saw it, not as the model wrote it
    const added = loop.added.slice(0, -1)
    const record: ConversationRecord = {
      user_id: input.user_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      messages: [
        ...(existing?.messages ?? []),
        ...added,
        { role: "assistant", content: reply.text, screens: reply.screens },
      ],
    }
    return new StepResponse<AssistantRunOutput>({
      ...base,
      record,
      reply,
      error: null,
      calls: callRecords(loop, reply),
      tool_counts: loop.toolCounts,
    })
  }
)

/**
 * Keeps the conversation under the person's key. Undone by putting back
 * what was there before (or nothing), so a failed turn leaves the
 * conversation as it was.
 */
export const assistantSaveStep = createStep(
  "ai-assistant-save",
  async (input: { conversation_id: string; record: ConversationRecord | null }) => {
    if (input.record === null) {
      return new StepResponse(false, null)
    }
    const store = conversationStore()
    const key = conversationKey(input.record.user_id, input.conversation_id)
    const previous = await store.get(key)
    await saveConversation(store, input.conversation_id, input.record)
    return new StepResponse(true, { key, id: input.conversation_id, previous })
  },
  async (undo) => {
    if (!undo) {
      return
    }
    const store = conversationStore()
    if (undo.previous === null) {
      await store.remove(undo.key)
      return
    }
    await saveConversation(store, undo.id, undo.previous)
  }
)

/** The error a turn that did not answer is raised as, after its calls are recorded. */
export function turnError(service: string, error: NonNullable<AssistantRunOutput["error"]>): Error {
  return error.kind === "provider"
    ? aiProviderError({ service, key: error.key, code: error.code })
    : aiValidationError(error.key)
}
