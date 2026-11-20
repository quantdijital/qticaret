import { ProviderError } from "../../errors/errors"
import { correctionFailure, resetAiBreakers, withAiBreaker } from "../breaker"
import type { TextConnector } from "../connectors/types"
import { aiProviderError } from "../errors"
import { withShop } from "../facts"
import { systemOf } from "../instructions"
import { MAX_DATA_CHARS, MIN_CLIPPED_LENGTH, buildPrompt } from "../prompt"
import { SEO_TITLE_TASK } from "../registry/tasks"
import { runTextTask } from "../run-text"

/**
 * The security review of PR 237's findings closed with the guidance's
 * binding: D1, a failed correction counts on the service's breaker; B3,
 * the shop's name stands before the long texts and a block too long
 * clips its longest text before it drops a field.
 */

const TOO_LONG = `Keten Gömlek ${"Yazlık Örnekmarka Model ".repeat(4)}`
const GOOD = "Örnekmarka Keten Gömlek Yazlık, Rahat ve Hafif | Demo Mağaza"
const down = () =>
  aiProviderError({
    service: "fake",
    key: "ai.provider_unavailable",
    code: "http_503",
  })

// Answers in turn: a text, or a failure thrown
function answering(answers: (string | Error)[]): TextConnector {
  let calls = 0
  return {
    complete: () => {
      const next = answers[calls++ % answers.length] ?? ""
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve({
            text: next,
            usage: { inputTokens: 1, outputTokens: 1 },
          })
    },
  }
}

describe("a failed correction on the breaker (D1)", () => {
  beforeEach(() => {
    resetAiBreakers()
  })
  const options = { failureThreshold: 2, resetAfterMs: 60_000 }
  const prompt = buildPrompt({
    instruction: systemOf(SEO_TITLE_TASK, null, "product") ?? "",
    fields: {
      name: "Keten Gömlek Yazlık",
      brand: "Örnekmarka",
      shop: "Demo Mağaza",
    },
  })

  // As the call step runs it: the correction's failure read as the permit's last word
  const ask = (connector: TextConnector, counted = true) =>
    withAiBreaker(
      "fake",
      () =>
        runTextTask({
          connector,
          task: SEO_TITLE_TASK,
          prompt,
          mayCorrect: () => Promise.resolve(true),
        }),
      options,
      counted ? correctionFailure : undefined
    )

  it("opens the circuit after corrections that keep failing", async () => {
    const connector = answering([TOO_LONG, down()])
    for (let turn = 0; turn < 2; turn++) {
      const result = await ask(connector)
      expect(result).toMatchObject({
        status: "refused",
        correction: { status: "failed" },
      })
    }
    const call = jest.fn(() => Promise.resolve("ok"))
    await expect(withAiBreaker("fake", call, options)).rejects.toMatchObject({
      safeMessage: "ai.provider_unavailable",
      providerCode: "circuit_open",
    })
    expect(call).not.toHaveBeenCalled()
  })

  it("left uncounted, as before, the breaker never heard of them", async () => {
    const connector = answering([TOO_LONG, down()])
    for (let turn = 0; turn < 3; turn++) {
      await ask(connector, false)
    }
    await expect(withAiBreaker("fake", () => Promise.resolve(1), options)).resolves.toBe(1)
  })

  it("counts a correction that answered, or one refused by the service, as a success", async () => {
    const rejected = aiProviderError({
      service: "fake",
      key: "ai.key_rejected",
      code: "http_401",
    })
    await ask(answering([TOO_LONG, rejected]))
    await ask(answering([TOO_LONG, rejected]))
    await ask(answering([TOO_LONG, GOOD]))
    await expect(withAiBreaker("fake", () => Promise.resolve(1), options)).resolves.toBe(1)
    expect(correctionFailure({ correction: null })).toBeNull()
  })

  it("still opens on a first call that keeps failing", async () => {
    const connector = answering([down()])
    await expect(ask(connector)).rejects.toBeInstanceOf(ProviderError)
    await expect(ask(connector)).rejects.toBeInstanceOf(ProviderError)
    await expect(ask(connector)).rejects.toMatchObject({
      providerCode: "circuit_open",
    })
  })
})
describe("the data block's order and ceiling (B3)", () => {
  it("puts the shop's name before the first long text, at the end when there is none", () => {
    expect(
      Object.keys(withShop({ name: "a", description: "b", focus_keyword: "c" }, "Demo"))
    ).toEqual(["name", "shop", "description", "focus_keyword"])
    expect(Object.keys(withShop({ title: "a", body: "b" }, "Demo"))).toEqual([
      "title",
      "shop",
      "body",
    ])
    expect(Object.keys(withShop({ name: "a" }, "Demo"))).toEqual(["name", "shop"])
  })

  it("clips the long description before it leaves out a field, the shop kept", () => {
    // Each under the filter's own bound, together over the block's ceiling
    const description = "Keten kumaş, yazlık kesim. ".repeat(700)
    const notes = "Yıkama: 30 derece. ".repeat(900)
    const fields = withShop(
      { name: "Keten Gömlek", description, notes, focus_keyword: "keten gömlek" },
      "Demo Mağaza"
    )
    const { data } = buildPrompt({
      instruction: "Özet yaz.",
      fields,
      maxLengths: { description: 20_000, notes: 20_000 },
    })
    expect(data.length).toBeLessThanOrEqual(MAX_DATA_CHARS)
    const block = (JSON.parse(data) as { data: Record<string, string> }).data
    expect(Object.keys(block)).toEqual(["name", "shop", "description", "notes", "focus_keyword"])
    expect(block["notes"]).toBe(notes.trim())
    expect(block["shop"]).toBe("Demo Mağaza")
    expect(block["description"]?.endsWith("…")).toBe(true)
    expect(Array.from(block["description"] ?? "").length).toBeGreaterThan(MIN_CLIPPED_LENGTH)
  })
})
