import { isProviderError } from "../../errors/errors"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import {
  MAX_CONTENT_CHARS,
  MAX_TOKEN_COUNT,
  readCompletion,
  withoutThinking,
} from "../connectors/openai-response"
import { estimateCost } from "../cost"
import { MAX_SUGGESTION_CHARS, suggestionProblems, suggestionText } from "../gate"
import { MAX_DATA_CHARS, buildPrompt, promptData } from "../prompt"
import { findAiService } from "../registry/services"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"
import { TEST_TASK } from "../registry/tasks"

/** Security review of PR 0b-1 (2026-11-17): bounds on what a model and a shop may send. */

// Generous for a slow CI machine, far below what a quadratic scan of these inputs takes
const QUICK_MS = 1_000

function timed<T>(run: () => T): { result: T; ms: number } {
  const start = performance.now()
  const result = run()
  return { result, ms: performance.now() - start }
}

const bodyOf = (content: string, usage: Record<string, unknown> = {}) =>
  Buffer.from(JSON.stringify({ choices: [{ message: { content } }], usage }))

function deepseek(): { service: AiService; target: OpenAiCompatibleTarget } {
  const service = findAiService("deepseek", "test")
  const target = service?.capabilities.text
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error("deepseek has no text target")
  }
  return { service, target }
}

describe("model output bounds (O1, O2, D4)", () => {
  it("refuses an answer over the ceiling before scanning it", () => {
    const unclosed = "<think>".repeat(Math.ceil(200_000 / 7))
    const { result, ms } = timed(() => readCompletion(bodyOf(unclosed)))

    expect(result).toEqual({
      ok: false,
      key: "ai.provider_response_invalid",
      code: "content_too_long",
    })
    expect(ms).toBeLessThan(QUICK_MS)
    expect(readCompletion(bodyOf("a".repeat(MAX_CONTENT_CHARS + 1)))).toMatchObject({ ok: false })
    expect(readCompletion(bodyOf("a".repeat(MAX_CONTENT_CHARS)))).toMatchObject({ ok: true })
  })

  it("drops thinking in one pass, closed or not", () => {
    expect(withoutThinking("a<think>x</think>b<THINK>y</THINK>c")).toBe("abc")
    expect(withoutThinking("Sonuç<think>never closed")).toBe("Sonuç")
    expect(withoutThinking("plain")).toBe("plain")

    const { result, ms } = timed(() => withoutThinking("<think>".repeat(200_000)))
    expect(result).toBe("")
    expect(ms).toBeLessThan(QUICK_MS)
    // Under the ceiling, thinking that never closes leaves nothing to offer
    expect(readCompletion(bodyOf("<think>".repeat(100)))).toMatchObject({
      ok: false,
      code: "empty_content",
    })
  })

  it("cleans long runs of newlines, spaces and fences quickly", () => {
    for (const hostile of [
      "\n".repeat(200_000),
      `${" ".repeat(200_000)}x`,
      " \n".repeat(100_000),
      "```\n".repeat(50_000),
      "<a".repeat(100_000),
    ]) {
      const { result, ms } = timed(() => suggestionText(hostile))
      expect(ms).toBeLessThan(QUICK_MS)
      expect(result.length).toBeLessThanOrEqual(MAX_SUGGESTION_CHARS)
    }
    expect(suggestionText("Bir\n\n\n   \nİki")).toBe("Bir\nİki")
  })

  it("refuses a text longer than the task allows, for any gate", () => {
    const long = "Keten gömlek yazlık ve rahat. ".repeat(40)
    expect(Array.from(long).length).toBeGreaterThan(TEST_TASK.maxLength)
    expect(suggestionProblems(TEST_TASK, long)).toEqual(["length"])
    expect(suggestionProblems(TEST_TASK, "a".repeat(TEST_TASK.maxLength + 1))).toEqual(["length"])

    const huge = timed(() => suggestionProblems(TEST_TASK, "a@".repeat(100_000)))
    expect(huge.result).toEqual(["length"])
    expect(huge.ms).toBeLessThan(QUICK_MS)
  })

  it("refuses what is left of a tag that never closed", () => {
    const cleaned = suggestionText("Güzel gömlek <img src=x onerror=alert(1)")
    expect(suggestionProblems(TEST_TASK, cleaned)).toContain("markup")
    expect(suggestionProblems(TEST_TASK, suggestionText("Metin </script"))).toContain("markup")
    const seoTitle = { ...TEST_TASK, gate: "seo_title" as const }
    expect(suggestionProblems(seoTitle, "Keten Gömlek Erkek Yazlık <svg onload=x")).toContain(
      "markup"
    )
    // A comparison is text
    expect(suggestionProblems(TEST_TASK, "Genişlik 3 < 5 cm arasında.")).toEqual([])
  })
})

describe("counts and cost (D1)", () => {
  it("leaves out a count no call could have", () => {
    const read = readCompletion(
      bodyOf("Sonuç", { prompt_tokens: MAX_TOKEN_COUNT + 1, completion_tokens: MAX_TOKEN_COUNT })
    )
    expect(read).toEqual({
      ok: true,
      result: { text: "Sonuç", usage: { outputTokens: MAX_TOKEN_COUNT } },
    })
  })

  it("gives no estimate from a count that is not one, or a sum out of range", () => {
    const { service } = deepseek()
    for (const usage of [
      { inputTokens: -1 },
      { inputTokens: 1.5 },
      { inputTokens: Number.NaN },
      { outputTokens: Number.POSITIVE_INFINITY },
      { inputTokens: 10, outputTokens: -5 },
      { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: Number.MAX_SAFE_INTEGER },
    ]) {
      expect(estimateCost(service, "text", usage)).toBeNull()
    }
    expect(
      estimateCost(service, "text", { inputTokens: MAX_TOKEN_COUNT, outputTokens: MAX_TOKEN_COUNT })
    ).toEqual({ micros: 15_000_000, currency: "USD" })
  })
})

describe("prompt bounds (D2, D3)", () => {
  it("filters a very long value quickly, and still filters before the final cut", () => {
    const hostile = `${"a.".repeat(500_000)}@`
    const { result, ms } = timed(() => promptData({ name: hostile, description: hostile }))
    expect(ms).toBeLessThan(QUICK_MS)
    expect(Array.from(result["name"] as string).length).toBeLessThanOrEqual(301)

    const edge = promptData({ name: `${"x".repeat(295)} 0532 123 45 67` })
    expect(edge["name"]).not.toMatch(/0532/)
  })

  it("keeps the data block under its ceiling by dropping fields from the end", () => {
    const big = Array.from({ length: 30 }, (_, index) => ({
      label: `Özellik ${String(index)}`,
      value: "ç".repeat(2000),
    }))
    const fields = { name: "Keten Gömlek", attributes: big, more: big, description: "Son alan" }
    const { data } = buildPrompt({
      instruction: "Özet yaz.",
      fields,
      maxLengths: { attributes: 2000, more: 2000 },
    })

    expect(data.length).toBeLessThanOrEqual(MAX_DATA_CHARS)
    const block = JSON.parse(data) as { data: Record<string, unknown> }
    expect(Object.keys(block.data)).toEqual(["name"])

    const small = buildPrompt({ instruction: "Özet yaz.", fields: { name: "Keten Gömlek" } })
    expect(JSON.parse(small.data)).toEqual({ data: { name: "Keten Gömlek" } })
  })
})

describe("connector options (D5)", () => {
  it("refuses a timeout that is not a positive whole number, as a provider error", () => {
    for (const timeoutMs of [Number.NaN, -1, 0, 1.5, Number.POSITIVE_INFINITY]) {
      let thrown: unknown
      try {
        openAiCompatibleText({ ...deepseek(), apiKey: "test-key-not-a-real-one", timeoutMs })
      } catch (error) {
        thrown = error
      }
      expect(isProviderError(thrown)).toBe(true)
      expect(thrown).toMatchObject({
        safeMessage: "ai.provider_response_invalid",
        providerCode: "invalid_timeout",
      })
    }
  })
})
