import { measureGrowth } from "@qticaret/testing"
import type { TextConnector, TextRequest } from "../connectors/types"
import { AI_ENTITY_TYPES } from "../facts"
import { MAX_SUGGESTION_CHARS, suggestionProblems, suggestionTextFor } from "../gate"
import { systemOf, isTaskOption } from "../instructions"
import { buildPrompt } from "../prompt"
import {
  AI_CANDIDATE_COUNT,
  FOCUS_KEYWORD_MAX_COUNT,
  FOCUS_KEYWORD_MAX_LENGTH,
  FOCUS_KEYWORD_TASK,
  PRODUCT_TITLE_FACT_LENGTH,
  PRODUCT_TITLE_MAX_LENGTH,
  PRODUCT_TITLE_TASK,
} from "../registry/catalog-tasks"
import { findAiTask, isTaskEntity } from "../registry/tasks"
import { runTextTask } from "../run-text"
import { keywordLines, productTitleText, ungroundedWords } from "../short-text-gate"

/**
 * The product page's short texts (docs/22 "Ürün ekranı genişletme 1"):
 * a focus keyword with alternatives and a clearer product name. Their
 * instruction (fixed, Turkish, free of a price and a trade), their shape
 * (list marks and case a model adds are cleaned, never charged twice)
 * and their gate (a name holds no word the product's facts do not).
 */

const FACTS = {
  name: "Keten Gömlek Yazlık",
  brand: "Örnekmarka",
  category: "Gömlekler",
  attributes: [
    { label: "Malzeme", value: "Keten" },
    { label: "Renk", value: "Bej" },
    { label: "Beden", value: "XL 42" },
  ],
  description: "Nefes alan keten kumaştan, rahat kesim yazlık gömlek. Bilgi: ayse@example.com",
  shop: "Demo Mağaza",
}
const DATA = buildPrompt({ instruction: "x", fields: FACTS }).data

const answering = (text: string, seen: TextRequest[] = []): TextConnector => ({
  complete: (request) => {
    seen.push(request)
    return Promise.resolve({ text, usage: { inputTokens: 10, outputTokens: 5 } })
  },
})

describe("the product page's short text tasks: registry and instruction", () => {
  it("are synchronous text tasks for owners and admins, with no options", () => {
    for (const task of [FOCUS_KEYWORD_TASK, PRODUCT_TITLE_TASK]) {
      expect(findAiTask(task.id, "production")).toBe(task)
      expect(task).toMatchObject({
        capability: "text",
        mode: "sync",
        roles: ["owner", "admin"],
        credits: 1,
        options: [],
      })
      expect(task.gate).toBe(task.id)
      expect(isTaskOption(task, "short")).toBe(false)
    }
    expect(PRODUCT_TITLE_TASK.maxLength).toBe(PRODUCT_TITLE_MAX_LENGTH)
    expect(PRODUCT_TITLE_TASK.factMaxLengths).toEqual({ description: PRODUCT_TITLE_FACT_LENGTH })
  })

  it("asks a keyword for a page of its own, a name for a product only", () => {
    const kinds = (task: typeof FOCUS_KEYWORD_TASK) =>
      AI_ENTITY_TYPES.filter((type) => isTaskEntity(task, type))
    expect(kinds(FOCUS_KEYWORD_TASK)).toEqual([
      "product",
      "category",
      "collection",
      "brand",
      "page",
      "post",
    ])
    expect(kinds(PRODUCT_TITLE_TASK)).toEqual(["product"])
  })

  it("instructs in Turkish, bound to the data, with no price, and names the page", () => {
    const keyword = systemOf(FOCUS_KEYWORD_TASK, null, "category") ?? ""
    const title = systemOf(PRODUCT_TITLE_TASK, null, "product") ?? ""

    expect(keyword).toContain("kategori sayfası")
    expect(keyword).toContain("ana ifade")
    expect(keyword).toContain(`${String(FOCUS_KEYWORD_MAX_LENGTH)} karakter`)
    expect(title).toContain("ürün sayfası")
    expect(title).toContain(`${String(PRODUCT_TITLE_MAX_LENGTH)} karakteri asla geçme`)
    for (const text of [keyword, title]) {
      const lower = text.toLocaleLowerCase("tr")
      expect(lower).toContain("yalnızca verideki")
      expect(lower).not.toMatch(/₺|\btl\b|\d+[.,]\d{2}/)
    }
  })
})

describe("the focus keyword gate", () => {
  const shaped = (raw: string) => suggestionTextFor(FOCUS_KEYWORD_TASK, raw)

  it("reads one keyword per line, list marks, labels, quotes and case taken away", () => {
    expect(
      shaped(
        'Ana anahtar kelime: "Keten Gömlek"\n1. yazlık keten gömlek\n- Bej Keten Gömlek.\n• keten gömlek'
      )
    ).toBe("keten gömlek\nyazlık keten gömlek\nbej keten gömlek")
    expect(keywordLines("keten gömlek, yazlık gömlek; bej gömlek")).toEqual([
      "keten gömlek",
      "yazlık gömlek",
      "bej gömlek",
    ])
    expect(keywordLines("2-li set havlu")).toEqual(["2-li set havlu"])
    expect(keywordLines("a1\na2\na3\na4\na5\na6")).toHaveLength(FOCUS_KEYWORD_MAX_COUNT)
  })

  it("passes a list of search phrases", () => {
    const text = shaped("keten gömlek\nyazlık keten gömlek\nörnekmarka keten gömlek")
    expect(suggestionProblems(FOCUS_KEYWORD_TASK, text)).toEqual([])
  })

  it("refuses a sentence, a link, a person's data, markup and nothing at all", () => {
    const problems = (raw: string) => suggestionProblems(FOCUS_KEYWORD_TASK, shaped(raw))
    expect(problems("bu ürün yazın serin tutan rahat kesim keten bir gömlektir")).toContain(
      "length"
    )
    expect(problems(`${"uzun ".repeat(12)}gömlek`)).toContain("length")
    expect(problems(`${"k".repeat(40)} ${"g".repeat(30)}`)).toContain("length")
    expect(problems("keten gömlek\nwww.ornek-magaza.com.tr")).toContain("link")
    expect(problems("keten gömlek\nayse.yilmaz@example.com")).toEqual(
      expect.arrayContaining(["personal_data"])
    )
    expect(problems("keten gömlek (bej)")).toContain("noise")
    expect(problems("<img src=x onerror=alert(1) keten")).toContain("markup")
    expect(problems("[…] gömlek")).toContain("masked_name")
    expect(problems("1.\n-")).toEqual(["empty"])
  })
})

describe("the product name gate", () => {
  const problems = (raw: string) =>
    suggestionProblems(PRODUCT_TITLE_TASK, suggestionTextFor(PRODUCT_TITLE_TASK, raw), DATA)

  it("passes a name made of the product's own facts, Turkish endings and joining words too", () => {
    expect(problems('"Örnekmarka Yazlık Keten Gömlek, Bej, XL 42."')).toEqual([])
    expect(problems("Örnekmarka Keten Gömleği ve Rahat Kesim")).toEqual([])
    expect(suggestionTextFor(PRODUCT_TITLE_TASK, '"Keten Gömlek."')).toBe("Keten Gömlek")
  })

  it("refuses a word the facts do not hold: an invented feature, size or brand", () => {
    expect(problems("Örnekmarka Keten Gömlek Su Geçirmez")).toContain("ungrounded")
    expect(problems("Keten Gömlek XL 44")).toContain("ungrounded")
    expect(ungroundedWords("Başkamarka Keten Gömlek 44", DATA)).toEqual(["başkamarka", "44"])
    // The data block's keys are no facts
    expect(ungroundedWords("Keten Gömlek Attributes Label", DATA)).toEqual(["attributes", "label"])
  })

  it("refuses a second line, shouting, a link, a person's data and a name with no facts", () => {
    expect(problems("Keten Gömlek\nBej")).toContain("lines")
    expect(problems("ÖRNEKMARKA KETEN GÖMLEK YAZLIK")).toContain("noise")
    expect(problems("Keten Gömlek Keten Bej Keten")).toContain("noise")
    expect(problems("Keten Gömlek www.ornek.com")).toContain("link")
    // The address was filtered out of the data before it was sent, so it is also ungrounded
    expect(problems("Keten Gömlek ayse@example.com")).toEqual(
      expect.arrayContaining(["personal_data"])
    )
    expect(problems("x".repeat(PRODUCT_TITLE_MAX_LENGTH + 1))).toEqual(["length"])
    expect(suggestionProblems(PRODUCT_TITLE_TASK, "Keten Gömlek")).toContain("ungrounded")
  })

  it("holds the answer against the data block the call was sent, in the call itself", async () => {
    const seen: TextRequest[] = []
    const prompt = buildPrompt({
      instruction: systemOf(PRODUCT_TITLE_TASK, null, "product") ?? "",
      fields: FACTS,
    })
    const offered = await runTextTask({
      connector: answering("Örnekmarka Yazlık Keten Gömlek Bej", seen),
      task: PRODUCT_TITLE_TASK,
      prompt,
    })
    const invented = await runTextTask({
      connector: answering("Örnekmarka Keten Gömlek Ultra Premium"),
      task: PRODUCT_TITLE_TASK,
      prompt,
    })

    expect(offered).toMatchObject({
      status: "succeeded",
      text: "Örnekmarka Yazlık Keten Gömlek Bej",
    })
    expect(invented).toMatchObject({ status: "refused", problems: ["ungrounded"] })
    expect(seen[0]?.data).not.toContain("ayse@example.com")
    expect(seen[0]?.maxTokens).toBe(PRODUCT_TITLE_MAX_LENGTH * 2 * AI_CANDIDATE_COUNT)
  })

  it("offers a keyword list cleaned, one candidate per keyword, the main one as the text", async () => {
    const result = await runTextTask({
      connector: answering("1. Keten Gömlek\n2. Yazlık Keten Gömlek\n3. Bej Gömlek"),
      task: FOCUS_KEYWORD_TASK,
      prompt: { system: "s", data: DATA },
    })
    expect(result).toMatchObject({
      status: "succeeded",
      text: "keten gömlek",
      candidates: ["keten gömlek", "yazlık keten gömlek", "bej gömlek"],
    })
  })
})

/**
 * A long run of quotes or end marks in the middle of an answer (security
 * review): the shaping is linear, and an answer far over the task's length
 * is not shaped at all, so the length check refuses it at once.
 */
describe("shaping a long answer", () => {
  const LONG = MAX_SUGGESTION_CHARS - 2
  const MARKS = ['"', ".", "’", "…"]
  const run = (mark: string, size: number) => `a${mark.repeat(size)}b`
  const runs = MARKS.map((mark) => run(mark, LONG))
  // Timed at an eighth of the longest answer and at the longest: linear, not a wall-clock budget
  const BASE = Math.floor(LONG / 8)
  const linear = (shape: (text: string) => unknown) => (mark: string) =>
    measureGrowth((size) => {
      const text = run(mark, size)
      return () => shape(text)
    }, BASE)

  it("cuts quotes and end marks from the ends in linear time", () => {
    for (const mark of MARKS) {
      expect(linear(keywordLines)(mark)).toMatchObject({ linear: true })
      expect(linear(productTitleText)(mark)).toMatchObject({ linear: true })
    }
    // Only the ends: a run between words stays
    expect(productTitleText(`a${'"'.repeat(10)}b`)).toBe(`a${'"'.repeat(10)}b`)
    expect(productTitleText(`"''Keten Gömlek...`)).toBe("Keten Gömlek")
  })

  it("leaves an answer far over the task's length unshaped, and refuses it for its length", () => {
    for (const task of [FOCUS_KEYWORD_TASK, PRODUCT_TITLE_TASK]) {
      for (const mark of MARKS) {
        const shape = (text: string) => suggestionTextFor(task, text)
        expect(linear(shape)(mark)).toMatchObject({ linear: true })
      }
      for (const text of runs) {
        const shaped = suggestionTextFor(task, text)
        expect(shaped).toBe(text)
        expect(suggestionProblems(task, shaped, DATA)).toEqual(["length"])
      }
    }
  })
})
