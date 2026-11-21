import { SUMMARY_TEXT_MAX } from "../../catalog/summary"
import { correctionNote } from "../correction"
import { AI_ENTITY_TYPES } from "../facts"
import { suggestionCandidates, suggestionProblems } from "../gate"
import { takesGuidance } from "../guidance"
import {
  CRAFT_HEADING,
  RULES_HEADING,
  defaultCraftOf,
  isCraftTask,
  systemOf,
} from "../instructions"
import { AI_CANDIDATE_COUNT, PRODUCT_TITLE_TASK } from "../registry/catalog-tasks"
import {
  MAX_NEW_TAGS,
  MAX_SUGGESTED_CATEGORIES,
  MAX_SUGGESTED_TAGS,
  PRODUCT_CATEGORY_TASK,
  PRODUCT_TAGS_TASK,
  SHORT_DESCRIPTION_MAX_LENGTH,
  SHORT_DESCRIPTION_TASK,
  findAiTask,
  isTaskEntity,
} from "../registry/tasks"
import { sentenceCount } from "../short-text-gate"

/**
 * The product page's second widening (adr/0074 §5 madde 2): a short
 * description as three candidates through its own gate, and tags and
 * categories as JSON picks. Same roles as the product's other tasks;
 * only the prose task takes the shop's guidance and the owner's craft.
 */

const TASKS = [SHORT_DESCRIPTION_TASK, PRODUCT_TAGS_TASK, PRODUCT_CATEGORY_TASK]

describe("the product page's short description, tags and categories", () => {
  it("are synchronous product tasks for the roles a product name has", () => {
    for (const task of TASKS) {
      expect(findAiTask(task.id, "production")).toBe(task)
      expect(task).toMatchObject({ capability: "text", mode: "sync", options: [], credits: 1 })
      expect(task.roles).toEqual(PRODUCT_TITLE_TASK.roles)
      expect(AI_ENTITY_TYPES.filter((type) => isTaskEntity(task, type))).toEqual(["product"])
    }
    // The field's own cap, never typed twice
    expect(SHORT_DESCRIPTION_MAX_LENGTH).toBe(SUMMARY_TEXT_MAX)
    expect(SHORT_DESCRIPTION_TASK.candidates).toBe(AI_CANDIDATE_COUNT)
    expect(PRODUCT_TAGS_TASK.json).toBe(true)
    expect(PRODUCT_CATEGORY_TASK.json).toBe(true)
  })

  it("gives guidance and a craft to the short description only", () => {
    expect(takesGuidance(SHORT_DESCRIPTION_TASK)).toBe(true)
    expect(isCraftTask("short_description")).toBe(true)
    expect(defaultCraftOf("short_description")?.craft).toContain("Yöntem:")
    for (const task of [PRODUCT_TAGS_TASK, PRODUCT_CATEGORY_TASK]) {
      expect(takesGuidance(task)).toBe(false)
      expect(isCraftTask(task.id)).toBe(false)
      expect(defaultCraftOf(task.id)).toBeNull()
    }
    const system = systemOf(
      SHORT_DESCRIPTION_TASK,
      null,
      "product",
      "Sıcak bir dil.",
      "Kendi talimatım."
    )
    expect(system).toContain(CRAFT_HEADING)
    expect(system).toContain("Sıcak bir dil.")
  })

  it("asks for three one-line candidates of one or two sentences, the rules last", () => {
    const system = systemOf(SHORT_DESCRIPTION_TASK, null, "product") ?? ""
    expect(system).toContain("ürün sayfasına aittir")
    expect(system).toContain(`Tam olarak ${String(AI_CANDIDATE_COUNT)} farklı kısa açıklama`)
    expect(system).toContain(`en çok ${String(SUMMARY_TEXT_MAX)} karakter`)
    expect(system.indexOf("bir ya da iki cümle")).toBeGreaterThan(system.indexOf(RULES_HEADING))
    expect(system).not.toMatch(/<[a-z]/i)
  })

  it("asks a pick for one JSON object of codes from the named list, no reasons", () => {
    const tags = systemOf(PRODUCT_TAGS_TASK, null, "product") ?? ""
    expect(tags).toContain('"tag_choices"')
    expect(tags).toContain(`en çok ${String(MAX_SUGGESTED_TAGS)} kodun`)
    expect(tags).toContain(`en çok ${String(MAX_NEW_TAGS)} yeni etiket`)
    const categories = systemOf(PRODUCT_CATEGORY_TASK, null, "product") ?? ""
    expect(categories).toContain('"category_choices"')
    expect(categories).toContain(`en çok ${String(MAX_SUGGESTED_CATEGORIES)} kodun`)
    expect(categories).toContain("yeni kategori adı yazma")
    for (const system of [tags, categories]) {
      expect(system).toContain("tek bir JSON nesnesi")
      expect(system).toContain("gerekçe")
      expect(system.indexOf("tek bir JSON nesnesi")).toBeGreaterThan(system.indexOf(RULES_HEADING))
    }
  })

  it("passes a plain sentence or two, refuses a third, a link, a person's data", () => {
    const task = SHORT_DESCRIPTION_TASK
    const good =
      "Yazlık keten gömlek, nefes alan kumaşıyla sıcak günlerde rahat tutar. Düz kesimi her gün giyilir."
    expect(suggestionProblems(task, good)).toEqual([])
    expect(suggestionProblems(task, `${good} Üçüncü bir cümle daha.`)).toContain("sentences")
    expect(suggestionProblems(task, `${good} https://ornek.com`)).toContain("link")
    expect(
      suggestionProblems(task, "Bilgi için ayse.yilmaz@example.com adresine yazın.")
    ).toContain("personal_data")
    expect(suggestionProblems(task, "Kısa [...] bir açıklama.")).toContain("masked_name")
    expect(suggestionProblems(task, "a".repeat(SUMMARY_TEXT_MAX + 1))).toEqual(["length"])
  })

  it("counts sentences as a reader does: a number or a lower case word goes on", () => {
    expect(sentenceCount("3.5 cm genişliğinde bir kemer. Deri.")).toBe(2)
    expect(sentenceCount("Kalem, defter vb. ürünler için bir kutu.")).toBe(1)
    expect(sentenceCount("Bir! İki? Üç.")).toBe(3)
    expect(sentenceCount("")).toBe(0)
  })

  it("reads the candidates one a line, list marks dropped", () => {
    const raw =
      "1. Birinci açıklama burada.\n2. İkinci açıklama burada.\n3. Üçüncü açıklama burada."
    expect(suggestionCandidates(SHORT_DESCRIPTION_TASK, raw)).toEqual([
      "Birinci açıklama burada.",
      "İkinci açıklama burada.",
      "Üçüncü açıklama burada.",
    ])
  })

  it("tells a long one in the correction note, without its words", () => {
    const text = "Bir. İki. Üç gizli sözcük."
    const note = correctionNote(SHORT_DESCRIPTION_TASK, [{ text, problems: ["sentences"] }], "")
    expect(note).toContain("bir ya da iki cümle olmalı")
    expect(note).not.toContain("gizli")
  })
})
