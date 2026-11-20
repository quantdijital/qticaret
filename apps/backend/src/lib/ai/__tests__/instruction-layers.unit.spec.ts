import { RULES_WIN } from "../crafts/types"
import type { AiEntityType } from "../facts"
import { GUIDANCE_HEADING, RULES_HEADING, instructionLayersOf, systemOf } from "../instructions"
import { DATA_RULE, buildPrompt } from "../prompt"
import { AI_CANDIDATE_COUNT } from "../registry/catalog-tasks"
import { aiTasks, findAiTask } from "../registry/tasks"
import type { AiTask } from "../registry/tasks"

/**
 * adr/0074 §1: every text task's system message in its layers, the data
 * rule first and the rules that never change last, saying they win; the
 * shop's guidance (K2) has its labelled place between the craft and the
 * rules, and the craft carries a role, a method and a good and a bad example.
 */

const TEXT_TASKS = aiTasks("production").filter((task) => task.capability !== "image_edit")
function task(id: string): AiTask {
  const found = findAiTask(id, "production")
  if (!found) {
    throw new Error(`no task ${id}`)
  }
  return found
}
const entityOf = (each: AiTask): AiEntityType => each.entities?.[0] ?? "product"

describe("the system message's layers (adr/0074 §1)", () => {
  it("covers every text task, each with a craft and rules", () => {
    expect(TEXT_TASKS.map((each) => each.id).sort()).toEqual(
      [
        "focus_keyword",
        "image_alt_text",
        "product_description",
        "product_from_photo",
        "product_title",
        "question_answer",
        "review_reply",
        "review_summary",
        "seo_description",
        "seo_title",
      ].sort()
    )
    for (const each of TEXT_TASKS) {
      const layers = instructionLayersOf(each)
      expect(layers?.craft).toMatch(/^Rol: /)
      expect(layers?.craft).toContain("İyi ")
      expect(layers?.craft).toContain("Kötü ")
      expect(layers?.rules.endsWith(RULES_WIN)).toBe(true)
    }
  })

  it("orders data rule, page, craft, guidance, option and rules, the rules last", () => {
    const seo = task("seo_description")
    const system = systemOf(seo, "short", "category", "Samimi yaz, siz diye hitap et.") ?? ""
    const at = (part: string) => system.indexOf(part)

    expect(system.startsWith(DATA_RULE)).toBe(true)
    const order = [
      at(DATA_RULE),
      at("kategori sayfasına aittir"),
      at("Rol: "),
      at(GUIDANCE_HEADING),
      at("Seçilen ayar: Kısa tut"),
      at(RULES_HEADING),
    ]
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(system.endsWith(RULES_WIN)).toBe(true)
  })

  it("leaves the guidance's place out when the shop gave none (K2 not yet)", () => {
    for (const guidance of [undefined, null, "", "   "]) {
      expect(systemOf(task("seo_title"), null, "product", guidance)).not.toContain(GUIDANCE_HEADING)
    }
  })

  it("is sent as it is built: the data rule once, at the start", () => {
    const system = systemOf(task("seo_title"), null, "product") ?? ""
    const sent = buildPrompt({ instruction: system, fields: { name: "Örnek" } }).system
    expect(sent).toBe(system)
    expect(sent.split(DATA_RULE)).toHaveLength(2)
  })

  it("asks the short search texts for candidates, one per line", () => {
    for (const id of ["seo_title", "seo_description", "focus_keyword", "product_title"]) {
      expect(task(id).candidates).toBe(AI_CANDIDATE_COUNT)
      expect(instructionLayersOf(task(id))?.rules).toContain(
        `Tam olarak ${String(AI_CANDIDATE_COUNT)} farklı`
      )
    }
    for (const id of ["product_description", "review_reply", "image_alt_text"]) {
      expect(task(id).candidates).toBeUndefined()
      expect(instructionLayersOf(task(id))?.rules).not.toContain("Tam olarak")
    }
  })

  it("tells the search tasks the page's focus keyword and what it lists", () => {
    for (const id of ["seo_title", "seo_description", "focus_keyword"]) {
      const system = systemOf(task(id), null, "category") ?? ""
      expect(system).toContain('"focus_keyword"')
      expect(system).toContain('"products"')
    }
    expect(systemOf(task("seo_title"), null, "product")).toContain("başına yakın")
    expect(systemOf(task("product_description"), null, "product")).toContain("kime uygun")
  })

  it("keeps every task's rules bound to the data, with no price and nothing made up", () => {
    for (const each of TEXT_TASKS) {
      const system = systemOf(each, each.options[0] ?? null, entityOf(each)) ?? ""
      const rules = system.slice(system.indexOf(RULES_HEADING)).toLocaleLowerCase("tr")
      expect(rules).toMatch(/veride|yorumlarda|fotoğrafta/)
      expect(system).not.toMatch(/₺|\bTL\b|\d+[.,]\d{2}\s?(?:tl|₺)/i)
    }
  })

  it("asks a temperature by kind of text", () => {
    expect(task("seo_title").temperature).toBe(0.7)
    expect(task("product_description").temperature).toBe(0.8)
    expect(task("product_from_photo").temperature).toBe(0.2)
  })
})
