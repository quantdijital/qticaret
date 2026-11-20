import { fakeTextConnector } from "../connectors/fake"
import type { TextConnector, TextRequest } from "../connectors/types"
import { correctionNote, quoted, withCorrection } from "../correction"
import { aiProviderError } from "../errors"
import { suggestionCandidates } from "../gate"
import { RULES_HEADING, systemOf } from "../instructions"
import { buildPrompt } from "../prompt"
import { PRODUCT_TITLE_TASK } from "../registry/catalog-tasks"
import { SEO_TITLE_TASK } from "../registry/tasks"
import { runTextTask } from "../run-text"

/**
 * adr/0074 §4: a short text comes as candidates, each through the gate on
 * its own, those that pass offered in order; when none passes, the
 * service is asked once more with the gate's reasons, only if the day's
 * ceiling has room (`mayCorrect`); a failed correction leaves the refusal.
 */

const FACTS = { name: "Keten Gömlek Yazlık", brand: "Örnekmarka", shop: "Demo Mağaza" }
const prompt = buildPrompt({
  instruction: systemOf(SEO_TITLE_TASK, null, "product") ?? "",
  fields: FACTS,
})

// Answers in turn, recording what each call was sent
function answering(answers: (string | Error)[], seen: TextRequest[] = []): TextConnector {
  return {
    complete: (request) => {
      seen.push(request)
      const next = answers[seen.length - 1] ?? answers[answers.length - 1] ?? ""
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve({ text: next, usage: { inputTokens: 100, outputTokens: 20 } })
    },
  }
}

const GOOD_A = "Örnekmarka Keten Gömlek Yazlık, Rahat ve Hafif | Demo Mağaza"
const GOOD_B = "Yazlık Keten Gömlek: Örnekmarka'dan Nefes Alan Kumaş"
const TOO_LONG = `Keten Gömlek ${"Yazlık Örnekmarka Model ".repeat(4)}`
const SHORT = "Gömlek"

describe("candidates (adr/0074 §4)", () => {
  it("reads one per line, list marks and quotes dropped, repeats and extras left out", () => {
    expect(
      suggestionCandidates(
        SEO_TITLE_TASK,
        `1. "${GOOD_A}"\n2) ${GOOD_B}\n- ${GOOD_A}\n${SHORT}\nfazla`
      )
    ).toEqual([GOOD_A, GOOD_B, SHORT])
    expect(suggestionCandidates(PRODUCT_TITLE_TASK, '"Keten Gömlek."\nYazlık Gömlek')).toEqual([
      "Keten Gömlek",
      "Yazlık Gömlek",
    ])
  })

  it("offers the candidates that pass, in order, the first as the text", async () => {
    const result = await runTextTask({
      connector: answering([`${TOO_LONG}\n${GOOD_A}\n${SHORT}\n`]),
      task: SEO_TITLE_TASK,
      prompt,
    })
    expect(result).toMatchObject({ status: "succeeded", text: GOOD_A, candidates: [GOOD_A] })
  })

  it("asks for every candidate's room in one call", async () => {
    const seen: TextRequest[] = []
    await runTextTask({ connector: answering([GOOD_A], seen), task: SEO_TITLE_TASK, prompt })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.maxTokens).toBe(SEO_TITLE_TASK.maxLength * 2 * 3)
    expect(seen[0]?.temperature).toBe(0.7)
  })
})

describe("the one correction (adr/0074 §4)", () => {
  it("asks once more with the gate's reasons before the rules, and offers what passes", async () => {
    const seen: TextRequest[] = []
    const mayCorrect = jest.fn().mockResolvedValue(true)
    const result = await runTextTask({
      connector: answering([`${TOO_LONG}\n${SHORT}`, `${GOOD_A}\n${GOOD_B}`], seen),
      task: SEO_TITLE_TASK,
      prompt,
      mayCorrect,
    })

    expect(mayCorrect).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(2)
    const second = seen[1]?.system ?? ""
    expect(second).toContain("Düzeltme: önceki yanıtın denetimden geçmedi.")
    expect(second).toContain("1. aday: ")
    expect(second).toMatch(/\d+ karakter; 30 ile 60 karakter arası olmalı/)
    // The refused text is never sent back
    expect(second).not.toContain(TOO_LONG.trim())
    expect(second.indexOf("Düzeltme:")).toBeLessThan(second.lastIndexOf(RULES_HEADING))
    expect(seen[1]?.data).toBe(prompt.data)
    expect(result).toMatchObject({
      status: "succeeded",
      text: GOOD_A,
      candidates: [GOOD_A, GOOD_B],
      usage: { inputTokens: 100, outputTokens: 20 },
      correction: { status: "answered", attempt: { status: "succeeded" } },
    })
  })

  it("is not made when the day's ceiling has no room, nor when nothing allows it", async () => {
    const seen: TextRequest[] = []
    const result = await runTextTask({
      connector: answering([SHORT], seen),
      task: SEO_TITLE_TASK,
      prompt,
      mayCorrect: () => Promise.resolve(false),
    })
    expect(seen).toHaveLength(1)
    expect(result).toMatchObject({ status: "refused", problems: ["length"], correction: null })

    const alone = await runTextTask({ connector: answering([SHORT]), task: SEO_TITLE_TASK, prompt })
    expect(alone.correction).toBeNull()
  })

  it("leaves the first refusal when the correction fails, and returns its failure", async () => {
    const busy = aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
    const result = await runTextTask({
      connector: answering([SHORT, busy]),
      task: SEO_TITLE_TASK,
      prompt,
      mayCorrect: () => Promise.resolve(true),
    })
    expect(result).toMatchObject({ status: "refused", problems: ["length"] })
    expect(result.correction).toMatchObject({ status: "failed", error: busy })
  })

  it("gives the correction's problems when it is refused too, never a third call", async () => {
    const seen: TextRequest[] = []
    const result = await runTextTask({
      connector: answering([SHORT, "Keten Gömlek www.ornek.com Yazlık Rahat Kesim Model"], seen),
      task: SEO_TITLE_TASK,
      prompt,
      mayCorrect: () => Promise.resolve(true),
    })
    expect(seen).toHaveLength(2)
    expect(result).toMatchObject({ status: "refused", problems: ["link"] })
  })

  it("runs on the fake service: a title it cannot shorten is refused twice", async () => {
    let calls = 0
    const counted: TextConnector = {
      complete: (request) => {
        calls++
        return fakeTextConnector.complete(request)
      },
    }
    const long = buildPrompt({
      instruction: systemOf(SEO_TITLE_TASK, null, "product") ?? "",
      fields: { name: `Keten Gömlek ${"Yazlık Rahat Hafif ".repeat(8)}` },
    })
    const result = await runTextTask({
      connector: counted,
      task: SEO_TITLE_TASK,
      prompt: long,
      mayCorrect: () => Promise.resolve(true),
    })
    expect(calls).toBe(2)
    expect(result).toMatchObject({ status: "refused", problems: ["length"] })
    expect(result.correction).toMatchObject({ status: "answered" })
  })

  it("names an invented word back, but nothing of a text that reads as personal data", () => {
    const data = buildPrompt({ instruction: "x", fields: FACTS }).data
    const named = correctionNote(
      PRODUCT_TITLE_TASK,
      [{ text: "Keten Gömlek Ultra", problems: ["ungrounded"] }],
      data
    )
    // Quoted and labelled as the check's finding (security review of PR 237, D2)
    expect(named).toContain("(otomatik denetimin bulduğu sözcükler: “ultra”)")
    // A word's own quote marks cannot close the quote early
    expect(quoted(['a"b', "x”y", "‘z’"])).toBe("“ab”, “xy”, “z”")
    expect(named).not.toContain("1. aday")
    const quiet = correctionNote(
      PRODUCT_TITLE_TASK,
      [{ text: "Keten Gömlek 05321234567", problems: ["personal_data", "ungrounded"] }],
      data
    )
    expect(quiet).not.toContain("05321234567")
  })

  it("puts the note before the rules, or at the end of a message with none", () => {
    expect(withCorrection(`a\n\n${RULES_HEADING}\nkural`, "not")).toBe(
      `a\n\nnot\n\n${RULES_HEADING}\nkural`
    )
    expect(withCorrection("a", "not")).toBe("a\n\nnot")
  })
})
