import { aiProviderError } from "../../errors"
import type { ConverseRequest, ConverseResult, ToolConnector } from "../../connectors/types"
import type { StoredMessage } from "../conversation"
import {
  CONTEXT_MESSAGES,
  MAX_MODEL_CALLS,
  MAX_TOOL_RESULT_CHARS,
  MAX_TOOL_RUNS,
  runAssistantLoop,
  wrapResult,
} from "../loop"
import { PANEL_SCREENS, visibleScreens } from "../screens"
import { ASSISTANT_TOOLS } from "../tools"

/** adr/0079 §2, §7, §8 (Y1-1): the turn's loop and its ceilings, on scripted answers. */

function scripted(answers: ConverseResult[]): {
  connector: ToolConnector
  seen: ConverseRequest[]
} {
  const seen: ConverseRequest[] = []
  return {
    seen,
    connector: {
      converse: (request) => {
        seen.push(request)
        const next = answers.shift()
        return next ? Promise.resolve(next) : Promise.reject(new Error("no more answers"))
      },
    },
  }
}

const call = (name: string, args: string, id = "c1") => ({ id, name, arguments: args })
const owner = { role: "owner" as const, locale: "tr" as const, screens: PANEL_SCREENS }

const baseInput = (connector: ToolConnector, history: StoredMessage[] = []) => ({
  connector,
  system: "Rules.",
  history,
  message: "kargo ücreti nereden değişir",
  tools: ASSISTANT_TOOLS,
  context: owner,
  claim: () => Promise.resolve(true),
})

describe("runAssistantLoop", () => {
  it("runs the tool the model asks for and gives its result back as untrusted data", async () => {
    const { connector, seen } = scripted([
      { toolCalls: [call("find_screen", '{"query":"kargo ücreti"}')], usage: { inputTokens: 5 } },
      { text: "Şurada: [[settings.shipping.options]]", usage: { outputTokens: 7 } },
    ])

    const result = await runAssistantLoop(baseInput(connector))

    expect(result.status).toBe("answered")
    expect(result.text).toBe("Şurada: [[settings.shipping.options]]")
    expect(result.toolCounts).toEqual({ find_screen: 1 })
    expect(result.calls).toHaveLength(2)
    const toolMessage = seen[1]?.messages.find((each) => each.role === "tool")
    expect(toolMessage).toMatchObject({ role: "tool", toolCallId: "c1" })
    const wrapped = JSON.parse(toolMessage?.content ?? "{}") as {
      untrusted: boolean
      data: { screens: { key: string }[] }
    }
    expect(wrapped.untrusted).toBe(true)
    expect(wrapped.data.screens[0]?.key).toBe("settings.shipping.options")
    // The system message is the fixed one; the person's words go as the user's
    expect(seen[0]?.messages[0]).toEqual({ role: "system", content: "Rules." })
    expect(seen[0]?.messages[1]).toEqual({ role: "user", content: "kargo ücreti nereden değişir" })
    expect(seen[0]?.tools.map((tool) => tool.name)).toEqual(["find_screen", "explain_screen"])
  })

  it("refuses an unknown tool and arguments outside the schema, running nothing", async () => {
    const { connector, seen } = scripted([
      {
        toolCalls: [
          call("run_sql", '{"q":"select 1"}', "a"),
          call("find_screen", '{"query":"x","extra":1}', "b"),
          call("find_screen", "not json", "c"),
          call("explain_screen", '{"key":"../../etc"}', "d"),
        ],
        usage: {},
      },
      { text: "Bulamadım.", usage: {} },
    ])

    const result = await runAssistantLoop(baseInput(connector))

    expect(result.toolCounts).toEqual({ unknown_tool: 1, invalid_arguments: 3 })
    const contents = (seen[1]?.messages ?? [])
      .filter((each) => each.role === "tool")
      .map((each) => JSON.parse(each.content) as { data: { error: string } })
    expect(contents.map((each) => each.data.error)).toEqual([
      "unknown_tool",
      "invalid_arguments",
      "invalid_arguments",
      "invalid_arguments",
    ])
  })

  it("stops at four model calls a turn", async () => {
    const asking = Array.from({ length: 6 }, (_, index) => ({
      toolCalls: [call("find_screen", '{"query":"kargo"}', `c${String(index)}`)],
      usage: {},
    }))
    const { connector, seen } = scripted(asking)

    const result = await runAssistantLoop(baseInput(connector))

    expect(result.status).toBe("turn_limit")
    expect(seen).toHaveLength(MAX_MODEL_CALLS)
    expect(result.text).toBeNull()
  })

  it("runs at most six tools a turn, answering the rest with the limit", async () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      call("find_screen", '{"query":"kargo"}', `c${String(index)}`)
    )
    const { connector } = scripted([
      { toolCalls: many, usage: {} },
      { text: "Tamam.", usage: {} },
    ])

    const result = await runAssistantLoop(baseInput(connector))

    expect(result.toolCounts).toEqual({ find_screen: MAX_TOOL_RUNS, tool_limit: 2 })
  })

  it("claims each model call first and makes none the claim refuses", async () => {
    const { connector, seen } = scripted([
      { toolCalls: [call("find_screen", '{"query":"kargo"}')], usage: {} },
      { text: "Tamam.", usage: {} },
    ])
    let claims = 0
    const result = await runAssistantLoop({
      ...baseInput(connector),
      claim: () => Promise.resolve(++claims < 2),
    })

    expect(result.status).toBe("not_claimed")
    expect(seen).toHaveLength(1)
  })

  it("stops on a failed call and returns its error", async () => {
    const error = aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
    const result = await runAssistantLoop(baseInput({ converse: () => Promise.reject(error) }))
    expect(result.status).toBe("failed")
    expect(result.error).toBe(error)
    expect(result.calls).toEqual([{ usage: {}, duration_ms: expect.any(Number) as number, error }])
  })

  it("gives the model the last messages only, starting at a person's, and this turn whole", async () => {
    const history: StoredMessage[] = Array.from({ length: 30 }, (_, index) =>
      index % 2 === 0
        ? { role: "user" as const, content: `soru ${String(index)}` }
        : { role: "assistant" as const, content: `yanıt ${String(index)}` }
    )
    const { connector, seen } = scripted([{ text: "Tamam.", usage: {} }])

    await runAssistantLoop(baseInput(connector, history))

    const sent = seen[0]?.messages ?? []
    // The system message, at most twelve of the conversation, this turn's message among them
    expect(sent.length).toBeLessThanOrEqual(CONTEXT_MESSAGES + 1)
    expect(sent[1]?.role).toBe("user")
    expect(sent[sent.length - 1]).toEqual({ role: "user", content: "kargo ücreti nereden değişir" })
    expect(JSON.stringify(sent)).not.toContain('soru 0"')
  })
})

describe("the open screen (review D4)", () => {
  it("goes before the person's message as a data block, for the service only", async () => {
    const block = '{"untrusted":true,"open_screen":{"key":"orders"}}'
    const { connector, seen } = scripted([
      { toolCalls: [call("find_screen", '{"query":"kargo"}')], usage: {} },
      { text: "Tamam.", usage: {} },
    ])

    const result = await runAssistantLoop({ ...baseInput(connector), screen: block })

    for (const request of seen) {
      expect(request.messages[0]?.content).not.toContain("open_screen")
      expect(request.messages[1]).toEqual({
        role: "user",
        content: `${block}\n\nkargo ücreti nereden değişir`,
      })
    }
    expect(result.added[0]).toEqual({ role: "user", content: "kargo ücreti nereden değişir" })
  })
})

describe("wrapResult", () => {
  it("keeps a tool's result under 4,000 characters, marked untrusted", () => {
    const long = { screens: Array.from({ length: 200 }, () => ({ help: "x".repeat(100) })) }
    const text = wrapResult(long)
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS)
    expect(JSON.parse(text)).toMatchObject({ untrusted: true, truncated: true })
  })
})

describe("the tools a role sees", () => {
  it("searches only the screens the role sees", () => {
    const readonly = visibleScreens("readonly", new Set())
    expect(readonly.some((screen) => screen.key === "settings.shipping.options")).toBe(false)
    const owners = visibleScreens("owner", new Set())
    expect(owners.some((screen) => screen.key === "settings.shipping.options")).toBe(true)
  })
})
