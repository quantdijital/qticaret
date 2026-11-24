/**
 * Connectors: one narrow interface per capability (adr/0071 §2). The key
 * is given when a connector is made and lives only in its closure: it is
 * no part of a request, a result or an error.
 */

/** What the service counted; absent where it does not say. */
export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface AiImageInput {
  mimeType: string
  bytes: Buffer
}

export interface TextRequest {
  /** The fixed instruction (lib/ai/prompt.ts). */
  system: string
  /** The data block, a JSON text, sent as its own message. */
  data: string
  maxTokens: number
  /** Ask for a JSON object where the service documents such a mode. */
  json?: boolean
  /**
   * The task's sampling temperature (adr/0074 §4); sent only where the
   * service's target is documented to take one (`temperature`), else left out.
   */
  temperature?: number
  /** `vision` only. */
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}

export interface TextResult {
  text: string
  usage: AiUsage
}

/** `text` and `vision`. */
export interface TextConnector {
  complete: (request: TextRequest) => Promise<TextResult>
}

/** Text and image reading (adr/0071 §8). */
export const TEXT_TIMEOUT_MS = 60_000

/**
 * A tool the model may call (adr/0079 §3): a fixed name and description
 * from code, its arguments as a JSON Schema made from the tool's Zod
 * schema. Nothing here comes from a person or a service.
 */
export interface ToolSpec {
  name: string
  description: string
  parameters: Readonly<Record<string, unknown>>
}

/** A call the model asked for; `arguments` is its JSON text, unread until the loop checks it. */
export interface ToolCall {
  id: string
  name: string
  arguments: string
}

/**
 * One message of a tool calling conversation. The roles are the
 * service's (`system`, `user`, `assistant`, `tool`); a tool's result goes
 * in its own `tool` message, never in the user's (adr/0079 §7).
 */
export type ConverseMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: readonly ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string }

export interface ConverseRequest {
  messages: readonly ConverseMessage[]
  tools: readonly ToolSpec[]
  maxTokens: number
  signal?: AbortSignal
}

/** The model's text, the tools it asked for, or both; never neither. */
export interface ConverseResult {
  text?: string
  toolCalls?: ToolCall[]
  usage: AiUsage
}

/** `text` with tool calling (adr/0079 §2): only for a target whose tool support is verified. */
export interface ToolConnector {
  converse: (request: ConverseRequest) => Promise<ConverseResult>
}

/** One model call of an assistant's turn (adr/0079 §2): a turn takes 60 s at most. */
export const TOOL_CALL_TIMEOUT_MS = 30_000
