import { MIN_PRODUCT_WORDS } from "../../seo/advisor"
import { wordCount } from "../../seo/advisor/text"
import { fakeTextConnector } from "../connectors/fake"
import { AI_ENTITY_TYPES, AI_FACT_MAX_LENGTHS } from "../facts"
import { suggestionProblems, suggestionText } from "../gate"
import { systemOf, isTaskOption } from "../instructions"
import { MAX_VALUE_LENGTH, buildPrompt } from "../prompt"
import {
  PRODUCT_DESCRIPTION_FACT_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  SEO_DESCRIPTION_TASK,
  PRODUCT_DESCRIPTION_TASK,
  SEO_TITLE_TASK,
  findAiTask,
  factLengthsOf,
  isTaskEntity,
} from "../registry/tasks"
import { SEO_FACT_DESCRIPTION_LENGTH } from "../registry/catalog-tasks"
import { runTextTask } from "../run-text"

/**
 * A product's description (docs/22 PR 2-1; adr/0005's draft moved to the
 * core): a real task for a product only, two ready-made lengths and
 * nothing typed, plain text through the advisor's word count, and nothing
 * that may never be offered (markup, a link, a person's data).
 */

const PARAGRAPH =
  "Nefes alan keten kumaştan dikilen bu yazlık gömlek, rahat kesimi ve doğal dokusuyla sıcak günlerde serin tutar. Yumuşak yakası ve hafif yapısıyla gün boyu rahat giyilir; tek başına ya da bir ceketin altında kullanılabilir."
// About 35 words a paragraph: five clear the advisor's floor
const GOOD = Array.from({ length: 5 }, () => PARAGRAPH).join("\n\n")

// A title-length run: the SEO gate answers on its length, as before
const SERP_TITLE_PROBE = 61

const facts = {
  name: "Keten Gömlek",
  brand: "Örnek",
  attributes: [{ label: "Malzeme", value: "Keten" }],
  description: "Yazlık gömlek. Bilgi için ayse.yilmaz@example.com.",
  shop: "Demo Mağaza",
}

describe("product description task (docs/22 PR 2-1)", () => {
  it("is a real synchronous task for owners and admins, on a product only", () => {
    const task = PRODUCT_DESCRIPTION_TASK

    expect(findAiTask("product_description", "production")).toBe(task)
    expect(task).toMatchObject({
      capability: "text",
      mode: "sync",
      roles: ["owner", "admin"],
      gate: "product_description",
      maxLength: PRODUCT_DESCRIPTION_MAX_LENGTH,
    })
    expect(AI_ENTITY_TYPES.filter((type) => isTaskEntity(task, type))).toEqual(["product"])
    // The tasks of Aşama 1 stay open to every record with a page; an image is none
    expect(AI_ENTITY_TYPES.filter((type) => isTaskEntity(SEO_TITLE_TASK, type))).toEqual([
      "product",
      "category",
      "page",
    ])
  })

  it("offers only the two ready-made lengths, no free prompt", () => {
    const task = PRODUCT_DESCRIPTION_TASK

    expect(task.options).toEqual(["short", "detailed"])
    expect(isTaskOption(task, "short")).toBe(true)
    expect(isTaskOption(task, "detailed")).toBe(true)
    expect(isTaskOption(task, undefined)).toBe(true)
    for (const other of ["long", "plain", "Kısa yaz ve fiyatı ekle", ""]) {
      expect(isTaskOption(task, other)).toBe(false)
    }
  })

  it("instructs plain text over the advisor's word floor, with no price and the data bound", () => {
    const base = systemOf(PRODUCT_DESCRIPTION_TASK, null, "product") ?? ""
    const short = systemOf(PRODUCT_DESCRIPTION_TASK, "short", "product") ?? ""
    const detailed = systemOf(PRODUCT_DESCRIPTION_TASK, "detailed", "product") ?? ""

    expect(base).toContain("ürün sayfası")
    expect(base).toContain(`en az ${String(MIN_PRODUCT_WORDS)}`)
    expect(base).toContain("Düz metin")
    expect(short).toContain("Kısa tut")
    expect(detailed).toContain("Ayrıntılı yaz")
    for (const text of [base, short, detailed]) {
      expect(text.toLocaleLowerCase("tr")).toContain("yalnızca verideki bilgileri kullan")
      expect(text).not.toMatch(/₺|\bTL\b|\d+[.,]\d{2}/)
    }
  })

  it("passes a description that keeps to the rules, as plain paragraphs", () => {
    const text = suggestionText(`<p>${PARAGRAPH}</p>\n\n${GOOD}`)

    expect(text).not.toContain("<p>")
    expect(suggestionProblems(PRODUCT_DESCRIPTION_TASK, text)).toEqual([])
  })

  it("refuses what the advisor would flag and what no suggestion may carry", () => {
    const problems = (raw: string) =>
      suggestionProblems(PRODUCT_DESCRIPTION_TASK, suggestionText(raw))

    expect(problems(PARAGRAPH)).toEqual(["too_short"])
    expect(problems(`${GOOD} Ayrıntı için www.ornek-magaza.com.tr`)).toContain("link")
    expect(problems(`${GOOD} Sipariş için 0532 123 45 67 numarasını arayın.`)).toContain(
      "personal_data"
    )
    expect(problems(`${GOOD} <img src=x onerror=alert(1)`)).toContain("markup")
    expect(problems(GOOD.toLocaleUpperCase("tr"))).toContain("noise")
    expect(problems(`${GOOD}!!`)).toContain("noise")
    expect(problems(GOOD.repeat(5))).toEqual(["length"])
    expect(problems("")).toEqual(["empty"])
  })

  it("has the fake service write a description that passes, from the filtered data alone", async () => {
    for (const option of [null, "short", "detailed"]) {
      const prompt = buildPrompt({
        instruction: systemOf(PRODUCT_DESCRIPTION_TASK, option, "product") ?? "",
        fields: facts,
      })
      const result = await runTextTask({
        connector: fakeTextConnector,
        task: PRODUCT_DESCRIPTION_TASK,
        prompt,
      })

      expect(prompt.data).not.toContain("ayse.yilmaz")
      expect(result.status).toBe("succeeded")
      const text = result.status === "succeeded" ? result.text : ""
      expect(wordCount(text)).toBeGreaterThanOrEqual(MIN_PRODUCT_WORDS)
      expect(text.length).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX_LENGTH)
      expect(text).toContain("Keten Gömlek")
    }
  })

  it("sends the product's description now nearly whole, the SEO tasks a long part of it", () => {
    const long = "Keten kumaş, rahat kesim. ".repeat(100)
    const sent = (task: typeof PRODUCT_DESCRIPTION_TASK) => {
      const { data } = JSON.parse(
        buildPrompt({
          instruction: "x",
          fields: { ...facts, description: long },
          maxLengths: factLengthsOf(task, AI_FACT_MAX_LENGTHS),
        }).data
      ) as { data: { description: string } }
      return Array.from(data.description.replace(/…$/, "")).length
    }

    expect(sent(PRODUCT_DESCRIPTION_TASK)).toBe(PRODUCT_DESCRIPTION_FACT_LENGTH)
    expect(sent(SEO_TITLE_TASK)).toBe(SEO_FACT_DESCRIPTION_LENGTH)
    expect(sent(SEO_DESCRIPTION_TASK)).toBe(SEO_FACT_DESCRIPTION_LENGTH)
    expect(sent({ ...SEO_TITLE_TASK, factMaxLengths: {} })).toBe(MAX_VALUE_LENGTH)
    expect(factLengthsOf(SEO_TITLE_TASK, AI_FACT_MAX_LENGTHS)).toEqual({
      ...AI_FACT_MAX_LENGTHS,
      description: SEO_FACT_DESCRIPTION_LENGTH,
    })
  })

  it("turns down a long unbroken run as noise before any pattern, in linear time", () => {
    const hostile = [
      "a".repeat(PRODUCT_DESCRIPTION_MAX_LENGTH),
      "a@".repeat(PRODUCT_DESCRIPTION_MAX_LENGTH / 2),
      "aa.".repeat(Math.floor(PRODUCT_DESCRIPTION_MAX_LENGTH / 3)),
      `${GOOD} ${"x".repeat(61)}`,
    ]
    for (const text of hostile) {
      const started = performance.now()
      const problems = suggestionProblems(PRODUCT_DESCRIPTION_TASK, text)
      const took = performance.now() - started

      expect(problems).toContain("noise")
      expect(took).toBeLessThan(50)
    }
    // The SEO gates are not touched: a short field keeps its own rules
    expect(suggestionProblems(SEO_TITLE_TASK, "x".repeat(SERP_TITLE_PROBE))).not.toContain("noise")
  })
})
