import { aiProviderError } from "../errors"
import type { OpenAiCompatibleTarget } from "../registry/services"
import { chatSender } from "./openai-compatible"
import type { AnswerRead, OpenAiCompatibleOptions } from "./openai-compatible"
import { MAX_CONTENT_CHARS, isRecord, parse, usageOf, withoutThinking } from "./openai-response"
import { TOOL_CALL_TIMEOUT_MS } from "./types"
import type {
  ConverseMessage,
  ConverseRequest,
  ConverseResult,
  ToolCall,
  ToolConnector,
} from "./types"

/**
 * Tool calling on the OpenAI style chat completion (adr/0079 §2): the
 * same address, key header, redirect refusal, retry and failure mapping as
 * the text connector (`chatSender`), with `tools` in the request and
 * `tool_calls` read from the answer. Only a target whose tool support is
 * verified in the registry is ever called; nothing else of the answer is
 * kept.
 */

/** More calls than this in one answer is not an answer the loop can use. */
export const MAX_TOOL_CALLS_READ = 8
const MAX_CALL_ID = 128
const MAX_TOOL_NAME = 64
/** A call's arguments as JSON text; the tools take a few short fields. */
export const MAX_ARGUMENTS_CHARS = 4_000

function messageOf(message: ConverseMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content }
  }
  if (message.role === "assistant") {
    const calls = message.toolCalls ?? []
    return {
      role: "assistant",
      content: message.content,
      ...(calls.length === 0
        ? {}
        : {
            tool_calls: calls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.arguments },
            })),
          }),
    }
  }
  return { role: message.role, content: message.content }
}

export function converseBodyOf(target: OpenAiCompatibleTarget, request: ConverseRequest): string {
  return JSON.stringify({
    ...target.body,
    model: target.model,
    messages: request.messages.map(messageOf),
    tools: request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    })),
    ...(target.toolCalls?.toolChoice === true && request.tools.length > 0
      ? { tool_choice: "auto" }
      : {}),
    stream: false,
    ...(target.maxTokensField === null ? {} : { [target.maxTokensField]: request.maxTokens }),
  })
}

/** One `tool_calls` item, or null for anything not shaped as one. */
function callOf(value: unknown): ToolCall | null {
  if (!isRecord(value) || !isRecord(value["function"])) {
    return null
  }
  const id = value["id"]
  const name = value["function"]["name"]
  const args = value["function"]["arguments"]
  if (typeof id !== "string" || id === "" || id.length > MAX_CALL_ID) {
    return null
  }
  if (typeof name !== "string" || name === "" || name.length > MAX_TOOL_NAME) {
    return null
  }
  // Some services leave empty arguments out; an object of none is what they mean
  const text = args === undefined || args === null || args === "" ? "{}" : args
  if (typeof text !== "string" || text.length > MAX_ARGUMENTS_CHARS) {
    return null
  }
  return { id, name, arguments: text }
}

/** The text and the tool calls of a successful answer, or why it is not one. */
export function readToolCompletion(body: Buffer): AnswerRead<ConverseResult> {
  const invalid = (code: string): AnswerRead<ConverseResult> => ({
    ok: false,
    key: "ai.provider_response_invalid",
    code,
  })
  const answer = parse(body)
  if (answer === null) {
    return invalid("not_json")
  }
  const choices = answer["choices"]
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined
  if (!isRecord(choice)) {
    return invalid("no_choice")
  }
  if (choice["finish_reason"] === "content_filter") {
    return { ok: false, key: "ai.content_blocked", code: "content_filter" }
  }
  const message = choice["message"]
  if (!isRecord(message)) {
    return invalid("no_message")
  }
  const content = message["content"]
  if (content !== undefined && content !== null && typeof content !== "string") {
    return invalid("no_content")
  }
  if (typeof content === "string" && content.length > MAX_CONTENT_CHARS) {
    return invalid("content_too_long")
  }
  const rawCalls = message["tool_calls"]
  if (rawCalls !== undefined && rawCalls !== null && !Array.isArray(rawCalls)) {
    return invalid("tool_calls_invalid")
  }
  const listed: unknown[] = Array.isArray(rawCalls) ? rawCalls : []
  if (listed.length > MAX_TOOL_CALLS_READ) {
    return invalid("tool_calls_too_many")
  }
  const toolCalls: ToolCall[] = []
  for (const each of listed) {
    const call = callOf(each)
    if (call === null) {
      return invalid("tool_call_invalid")
    }
    toolCalls.push(call)
  }
  const text = typeof content === "string" ? withoutThinking(content).trim() : ""
  if (text === "" && toolCalls.length === 0) {
    return invalid("empty_content")
  }
  return {
    ok: true,
    result: {
      ...(text === "" ? {} : { text }),
      ...(toolCalls.length === 0 ? {} : { toolCalls }),
      usage: usageOf(answer),
    },
  }
}

export function openAiCompatibleTools(options: OpenAiCompatibleOptions): ToolConnector {
  const { service, target } = options
  const post = chatSender({ ...options, timeoutMs: options.timeoutMs ?? TOOL_CALL_TIMEOUT_MS })
  return {
    converse(request: ConverseRequest): Promise<ConverseResult> {
      // The registry's word, checked again here: an unverified target is never called
      if (target.toolCalls?.verified !== true) {
        return Promise.reject(
          aiProviderError({
            service: service.id,
            key: "ai.service_unavailable",
            code: "tools_unverified",
          })
        )
      }
      return post(converseBodyOf(target, request), readToolCompletion, request.signal)
    },
  }
}
