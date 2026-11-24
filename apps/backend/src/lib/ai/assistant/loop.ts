import type {
  AiUsage,
  ConverseMessage,
  ConverseResult,
  ToolCall,
  ToolConnector,
} from "../connectors/types"
import { lastMessages } from "./conversation"
import type { StoredMessage } from "./conversation"
import { specOf } from "./tools"
import type { AssistantTool, ToolContext } from "./tools"

/**
 * One turn of the assistant (adr/0079 §2, §7, §8): the model, the tools
 * it calls, their results, the model again, until it answers in words.
 * At most 4 model calls and 6 tool runs a turn; each model call is claimed
 * first (the daily ceilings and credits, `claim`). A tool the model may
 * not see or whose arguments do not pass its Zod schema is not run: the
 * model is told a registered code and the count goes up. A result goes
 * back in its own `tool` message, marked as untrusted data, at most 4,000
 * characters. The model is given the last 12 messages and the whole of
 * this turn; nothing is summed up.
 */

export const MAX_MODEL_CALLS = 4
export const MAX_TOOL_RUNS = 6
export const MAX_TOOL_RESULT_CHARS = 4_000
export const CONTEXT_MESSAGES = 12
/** The reply's budget: a few sentences and a screen or two. */
export const ASSISTANT_MAX_TOKENS = 1_000

/** Why a call was not run; counted with the tools' names (ai_usage, the log). */
export type ToolRefusal = "unknown_tool" | "invalid_arguments" | "tool_limit" | "tool_failed"

export interface ModelCall {
  usage: AiUsage
  duration_ms: number
  /** The connector's error when the call failed; the turn stops there. */
  error: unknown
}

export interface LoopInput {
  connector: ToolConnector
  system: string
  /** The conversation so far, as kept on the server. */
  history: readonly StoredMessage[]
  /** The person's new message, personal data patterns already taken out. */
  message: string
  /**
   * The open screen as untrusted data (`screenContextBlock`): put before
   * the person's message for the service only, never kept.
   */
  screen?: string | null
  tools: readonly AssistantTool[]
  context: ToolContext
  /** Claims the next model call; false ends the turn before it is made. */
  claim: () => Promise<boolean>
  signal?: AbortSignal
}

export interface LoopResult {
  status: "answered" | "turn_limit" | "not_claimed" | "failed"
  /** This turn's messages to keep: the person's, the tool steps and the reply. */
  added: StoredMessage[]
  /** The model's words when it answered, unchecked (`reply.ts` gates them). */
  text: string | null
  calls: ModelCall[]
  /** Tool runs and refusals by name: `find_screen: 2`, `unknown_tool: 1`. */
  toolCounts: Record<string, number>
  error: unknown
}

/** A tool's result as the model is given it: marked untrusted, never over the limit. */
export function wrapResult(data: unknown): string {
  const whole = JSON.stringify({ untrusted: true, data })
  if (whole.length <= MAX_TOOL_RESULT_CHARS) {
    return whole
  }
  const json = JSON.stringify(data)
  let room = MAX_TOOL_RESULT_CHARS - 200
  for (;;) {
    const cut = JSON.stringify({ untrusted: true, truncated: true, data: json.slice(0, room) })
    if (cut.length <= MAX_TOOL_RESULT_CHARS || room <= 0) {
      return cut.length <= MAX_TOOL_RESULT_CHARS
        ? cut
        : JSON.stringify({ untrusted: true, truncated: true })
    }
    room -= 500
  }
}

/** The messages as a service takes them: the kept screens left out. */
const forService = (messages: readonly StoredMessage[]): ConverseMessage[] =>
  messages.map((message): ConverseMessage => {
    if (message.role === "assistant") {
      return message.toolCalls === undefined
        ? { role: "assistant", content: message.content }
        : { role: "assistant", content: message.content, toolCalls: message.toolCalls }
    }
    if (message.role === "tool") {
      return { role: "tool", toolCallId: message.toolCallId, content: message.content }
    }
    return message.role === "user"
      ? { role: "user", content: message.content }
      : { role: "system", content: message.content }
  })

function runCall(
  call: ToolCall,
  tools: ReadonlyMap<string, AssistantTool>,
  context: ToolContext
): { data: unknown; count: string } {
  const tool = tools.get(call.name)
  if (tool === undefined) {
    return { data: { error: "unknown_tool" }, count: "unknown_tool" }
  }
  let args: unknown
  try {
    args = JSON.parse(call.arguments)
  } catch {
    return { data: { error: "invalid_arguments" }, count: "invalid_arguments" }
  }
  const parsed = tool.input.safeParse(args)
  if (!parsed.success) {
    return { data: { error: "invalid_arguments" }, count: "invalid_arguments" }
  }
  try {
    return { data: tool.run(context, parsed.data).model, count: tool.id }
  } catch {
    return { data: { error: "tool_failed" }, count: "tool_failed" }
  }
}

/** The person's message with the open screen's data block before it, when there is one. */
const withScreen = (message: ConverseMessage, screen: string | null): ConverseMessage =>
  screen === null || message.role !== "user"
    ? message
    : { role: "user", content: `${screen}\n\n${message.content}` }

export async function runAssistantLoop(input: LoopInput): Promise<LoopResult> {
  const tools = new Map(input.tools.map((tool) => [tool.id, tool]))
  const specs = input.tools.map(specOf)
  const added: StoredMessage[] = [{ role: "user", content: input.message }]
  const calls: ModelCall[] = []
  const toolCounts: Record<string, number> = {}
  const count = (name: string) => {
    toolCounts[name] = (toolCounts[name] ?? 0) + 1
  }
  const result = (status: LoopResult["status"], text: string | null, error: unknown = null) => ({
    status,
    added,
    text,
    calls,
    toolCounts,
    error,
  })
  let runs = 0
  for (let round = 0; round < MAX_MODEL_CALLS; round++) {
    if (!(await input.claim())) {
      return result("not_claimed", null)
    }
    // This turn whole, and as much of the earlier conversation as the window holds
    const room = Math.max(0, CONTEXT_MESSAGES - added.length)
    const [own, ...steps] = forService(added)
    const messages: ConverseMessage[] = [
      { role: "system", content: input.system },
      ...forService(room === 0 ? [] : lastMessages(input.history, room)),
      ...(own === undefined ? [] : [withScreen(own, input.screen ?? null)]),
      ...steps,
    ]
    const started = Date.now()
    let answer: ConverseResult
    try {
      answer = await input.connector.converse({
        messages,
        tools: specs,
        maxTokens: ASSISTANT_MAX_TOKENS,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      })
    } catch (error) {
      calls.push({ usage: {}, duration_ms: Date.now() - started, error })
      return result("failed", null, error)
    }
    calls.push({ usage: answer.usage, duration_ms: Date.now() - started, error: null })
    const asked = answer.toolCalls ?? []
    if (asked.length === 0) {
      const text = answer.text ?? ""
      added.push({ role: "assistant", content: text })
      return result("answered", text)
    }
    added.push({ role: "assistant", content: answer.text ?? null, toolCalls: asked })
    // Every call gets its answer (a service refuses a call left without one); past the
    // turn's runs, the answer is the limit
    for (const call of asked) {
      let outcome: { data: unknown; count: string }
      if (runs >= MAX_TOOL_RUNS) {
        outcome = { data: { error: "tool_limit" }, count: "tool_limit" }
      } else {
        runs += 1
        outcome = runCall(call, tools, input.context)
      }
      count(outcome.count)
      added.push({ role: "tool", toolCallId: call.id, content: wrapResult(outcome.data) })
    }
  }
  return result("turn_limit", null)
}
