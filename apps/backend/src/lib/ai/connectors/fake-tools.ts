import { aiProviderError } from "../errors"
import { FAKE_SERVICE } from "../registry/services"
import { isRecord } from "./openai-response"
import type { ConverseMessage, ConverseRequest, ConverseResult, ToolConnector } from "./types"

/**
 * The fake service's tool calling (adr/0079 §10): one fixed scenario, no
 * model and no network. A person's message is looked up with
 * `find_screen` (the message itself as the query); the tools' results
 * are answered with the first screen they name, by its key. Tests that
 * need another turn replace `converse` with their own answers.
 */

const MAX_FAKE_QUERY = 120

// A rough count, the same every time: four characters a token
const tokens = (messages: readonly ConverseMessage[]) =>
  Math.ceil(messages.reduce((sum, each) => sum + (each.content?.length ?? 0), 0) / 4)

/** The screens' keys in these tool results, in their order. */
function screenKeysOf(messages: readonly ConverseMessage[]): string[] {
  const keys: string[] = []
  for (const message of messages) {
    if (message.role !== "tool") {
      continue
    }
    try {
      const wrapped: unknown = JSON.parse(message.content)
      const data = isRecord(wrapped) && isRecord(wrapped["data"]) ? wrapped["data"] : {}
      const screens = Array.isArray(data["screens"]) ? (data["screens"] as unknown[]) : []
      for (const screen of screens) {
        if (isRecord(screen) && typeof screen["key"] === "string") {
          keys.push(screen["key"])
        }
      }
    } catch {
      // Not a result of ours: nothing to name
    }
  }
  return keys
}

export const fakeToolConnector: ToolConnector = {
  converse(request: ConverseRequest): Promise<ConverseResult> {
    if (request.signal?.aborted) {
      return Promise.reject(
        aiProviderError({ service: FAKE_SERVICE.id, key: "ai.timeout", code: "aborted" })
      )
    }
    const usage = { inputTokens: tokens(request.messages), outputTokens: 12 }
    const last = request.messages[request.messages.length - 1]
    if (last?.role === "user") {
      if (!request.tools.some((tool) => tool.name === "find_screen")) {
        return Promise.resolve({ text: "Bunu yapamıyorum.", usage })
      }
      const query = Array.from(last.content).slice(0, MAX_FAKE_QUERY).join("")
      return Promise.resolve({
        toolCalls: [
          { id: "fake_call_1", name: "find_screen", arguments: JSON.stringify({ query }) },
        ],
        usage,
      })
    }
    const lastUser = request.messages.map((each) => each.role).lastIndexOf("user")
    const [first] = screenKeysOf(request.messages.slice(lastUser + 1))
    return Promise.resolve({
      text:
        first === undefined
          ? "Bununla ilgili bir ekran bulamadım."
          : `Bunu şu ekrandan yapabilirsiniz: [[${first}]]`,
      usage,
    })
  },
}
