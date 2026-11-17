import { ProviderError } from "../../errors/errors"
import { resetAiBreakers, withAiBreaker } from "../breaker"
import { textConnectorFor, textTargetOf } from "../connector-of"
import type { TextConnector } from "../connectors/types"
import { aiProviderError } from "../errors"
import type { AiErrorKey } from "../errors"
import { instructionOf, isTaskOption } from "../instructions"
import { failureOf, notTakenByService } from "../outcome"
import { buildPrompt } from "../prompt"
import { TEST_TASK } from "../registry/tasks"
import { runTextTask } from "../run-text"

/** adr/0071 §8, §9 (PR 0b-3): the call's pieces the workflow puts together. */

const answering = (text: string): TextConnector => ({
  complete: () => Promise.resolve({ text, usage: { inputTokens: 10, outputTokens: 5 } }),
})
const failing = (key: AiErrorKey, code: string): TextConnector => ({
  complete: () => Promise.reject(aiProviderError({ service: "fake", key, code })),
})
const prompt = { system: "s", data: '{"data":{}}' }
const KEY = "test-key-core-call-0000"

describe("runTextTask", () => {
  it("offers only a text that passed the gate, markup taken out", async () => {
    const result = await runTextTask({
      connector: answering("<b>Keten gömlek</b>, yazlık"),
      task: TEST_TASK,
      prompt,
    })

    expect(result).toEqual({
      status: "succeeded",
      text: "Keten gömlek , yazlık",
      usage: { inputTokens: 10, outputTokens: 5 },
    })
  })

  it("gives problems and no text for an answer the gate turns down", async () => {
    const result = await runTextTask({
      connector: answering("Bilgi için www.ornek-magaza.com adresine bakın"),
      task: TEST_TASK,
      prompt,
    })

    expect(result.status).toBe("refused")
    expect(result).not.toHaveProperty("text")
    expect(result.status === "refused" && result.problems).toContain("link")
  })

  it("lets a failed call's error through", async () => {
    await expect(
      runTextTask({ connector: failing("ai.key_rejected", "http_401"), task: TEST_TASK, prompt })
    ).rejects.toMatchObject({ safeMessage: "ai.key_rejected" })
  })
})

describe("textConnectorFor", () => {
  it("builds the fake service's connector in tests and development only", async () => {
    for (const env of ["test", "development"]) {
      const connector = textConnectorFor("fake", "text", KEY, env)
      const data = buildPrompt({ instruction: "x", fields: { name: "Keten gömlek" } }).data
      await expect(connector.complete({ system: "x", data, maxTokens: 64 })).resolves.toMatchObject(
        { text: "Keten gömlek" }
      )
    }
    // Owner's decision (PR 167): never on staging or production, nor with NODE_ENV empty
    for (const env of ["staging", "production", ""]) {
      expect(textTargetOf("fake", "text", env)).toBeNull()
      expect(() => textConnectorFor("fake", "text", KEY, env)).toThrow(ProviderError)
    }
  })

  it("refuses a service or capability the registry does not have", () => {
    let thrown: unknown
    try {
      textConnectorFor("nope", "text", KEY, "test")
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ safeMessage: "ai.service_unavailable" })
    expect(textTargetOf("deepseek", "vision", "test")).toBeNull()
    expect(textTargetOf("deepseek", "text", "production")?.target.connector).toBe(
      "openai-compatible"
    )
  })
})

describe("failureOf", () => {
  const of = (key: AiErrorKey, code: string) =>
    failureOf(aiProviderError({ service: "fake", key, code }))

  it("tells the caller's cancelling from the service's timeout", () => {
    expect(of("ai.timeout", "timeout")).toMatchObject({ status: "timeout", unwell: true })
    expect(of("ai.timeout", "aborted")).toMatchObject({ status: "cancelled", unwell: false })
  })

  it("counts only an unreachable service as unwell; a refusal is an answer", () => {
    expect(of("ai.provider_unavailable", "http_503")).toMatchObject({
      status: "failed",
      unwell: true,
    })
    expect(of("ai.provider_unavailable", "circuit_open")).toMatchObject({ unwell: false })
    for (const key of ["ai.key_rejected", "ai.provider_balance", "ai.provider_busy"] as const) {
      expect(of(key, "http_4xx")).toMatchObject({ status: "failed", unwell: false, answered: true })
    }
  })

  it("makes anything else a plain failure with no text of its own", () => {
    expect(failureOf(new Error("boom test-key-leak"))).toEqual({
      status: "failed",
      key: "ai.provider_response_invalid",
      code: "unexpected",
      unwell: false,
      answered: false,
    })
  })
})

describe("notTakenByService (D3)", () => {
  it("gives the quota back only when the service never took the job", () => {
    const back: [AiErrorKey, string | null][] = [
      ["ai.key_rejected", "http_401"],
      ["ai.provider_balance", "http_402"],
      ["ai.provider_busy", "http_429"],
      ["ai.service_unavailable", "no_credentials"],
      ["ai.service_unavailable", "not_registered"],
      ["ai.provider_unavailable", "circuit_open"],
      ["ai.provider_unavailable", "dns_failed"],
      ["ai.provider_unavailable", "connect_failed"],
      ["ai.provider_unavailable", "http_500"],
      ["ai.provider_unavailable", "http_503"],
    ]
    for (const [key, code] of back) {
      expect([key, code, notTakenByService(key, code)]).toEqual([key, code, true])
    }
  })

  it("keeps the quota when the service may have done the work", () => {
    const kept: [AiErrorKey, string | null][] = [
      ["ai.timeout", "timeout"],
      ["ai.timeout", "aborted"],
      ["ai.content_blocked", "content_filter"],
      ["ai.provider_response_invalid", "empty_content"],
      ["ai.provider_response_invalid", "unexpected"],
      // A connection cut after the request left: it may have been charged
      ["ai.provider_unavailable", "request_failed"],
      ["ai.provider_unavailable", null],
    ]
    for (const [key, code] of kept) {
      expect([key, code, notTakenByService(key, code)]).toEqual([key, code, false])
    }
  })
})

describe("withAiBreaker", () => {
  beforeEach(() => {
    resetAiBreakers()
  })
  const options = { failureThreshold: 2, resetAfterMs: 60_000 }
  const down = () =>
    Promise.reject(
      aiProviderError({ service: "a", key: "ai.provider_unavailable", code: "http_503" })
    )

  it("stops calling a service after repeated unwell failures, per service", async () => {
    await expect(withAiBreaker("a", down, options)).rejects.toBeInstanceOf(ProviderError)
    await expect(withAiBreaker("a", down, options)).rejects.toBeInstanceOf(ProviderError)
    const call = jest.fn(() => Promise.resolve("ok"))

    await expect(withAiBreaker("a", call, options)).rejects.toMatchObject({
      safeMessage: "ai.provider_unavailable",
      providerCode: "circuit_open",
    })
    expect(call).not.toHaveBeenCalled()
    await expect(withAiBreaker("b", call, options)).resolves.toBe("ok")
  })

  it("does not open for a refused key or a cancelled call", async () => {
    const rejected = () =>
      Promise.reject(aiProviderError({ service: "a", key: "ai.key_rejected", code: "http_401" }))
    const cancelled = () =>
      Promise.reject(aiProviderError({ service: "a", key: "ai.timeout", code: "aborted" }))
    for (const call of [rejected, rejected, cancelled, cancelled, cancelled]) {
      await expect(withAiBreaker("a", call, options)).rejects.toBeInstanceOf(ProviderError)
    }

    await expect(withAiBreaker("a", () => Promise.resolve(1), options)).resolves.toBe(1)
  })
})

describe("task instructions", () => {
  it("adds an option's sentence and refuses an option the task does not offer", () => {
    expect(instructionOf(TEST_TASK)).toEqual(expect.any(String))
    expect(instructionOf(TEST_TASK, "detailed")).toContain(instructionOf(TEST_TASK) ?? "-")
    expect(isTaskOption(TEST_TASK, "plain")).toBe(true)
    expect(isTaskOption(TEST_TASK, undefined)).toBe(true)
    expect(isTaskOption(TEST_TASK, "shout")).toBe(false)
    expect(instructionOf({ ...TEST_TASK, id: "unknown" })).toBeNull()
  })
})
