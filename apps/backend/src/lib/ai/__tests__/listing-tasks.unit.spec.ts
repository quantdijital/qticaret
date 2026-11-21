import { MIN_LISTING_WORDS } from "../../seo/advisor"
import { correctionNote } from "../correction"
import { AI_ENTITY_TYPES } from "../facts"
import { suggestionProblems } from "../gate"
import {
  CRAFT_HEADING,
  RULES_HEADING,
  defaultCraftOf,
  isCraftTask,
  systemOf,
} from "../instructions"
import {
  BRAND_DESCRIPTION_TASK,
  CATEGORY_DESCRIPTION_TASK,
  COLLECTION_DESCRIPTION_TASK,
  LISTING_DESCRIPTION_MAX_LENGTH,
  LISTING_WORDS,
  SEO_DESCRIPTION_TASK,
  SEO_TITLE_TASK,
  findAiTask,
  isTaskEntity,
} from "../registry/tasks"
import type { AiTask } from "../registry/tasks"
import { FOCUS_KEYWORD_TASK } from "../registry/catalog-tasks"

/**
 * A listing page's description (adr/0074 §5 madde 1): one task per kind
 * (category, collection, brand), on its own kind only, two ready-made
 * lengths; plain paragraphs through the advisor's listing word count; the
 * shop's guidance and the owner's craft apply as to any prose task. The
 * search text tasks reach a collection and a brand too.
 */

const PARAGRAPH =
  "Bu sayfada gün boyu yanınızda taşıyabileceğiniz içecek kapları bir arada duruyor. Çelik gövdeli modellerden hafif ve katlanabilir seçeneklere kadar farklı ihtiyaçlara uygun ürünler bulabilir, kullanım alanınıza göre seçim yapabilirsiniz."
// About 30 words a paragraph: four clear the listing floor
const GOOD = Array.from({ length: 4 }, () => PARAGRAPH).join("\n\n")

const TASKS: [AiTask, (typeof AI_ENTITY_TYPES)[number], string][] = [
  [CATEGORY_DESCRIPTION_TASK, "category", "kategori sayfasının"],
  [COLLECTION_DESCRIPTION_TASK, "collection", "koleksiyon sayfasının"],
  [BRAND_DESCRIPTION_TASK, "brand", "marka sayfasının"],
]

describe("listing description tasks (adr/0074 §5 madde 1)", () => {
  it("are real synchronous tasks for owners and admins, each on its own kind only", () => {
    for (const [task, kind] of TASKS) {
      expect(findAiTask(task.id, "production")).toBe(task)
      expect(task).toMatchObject({
        capability: "text",
        mode: "sync",
        options: ["short", "detailed"],
        roles: ["owner", "admin"],
        gate: "listing_description",
        maxLength: LISTING_DESCRIPTION_MAX_LENGTH,
      })
      expect(AI_ENTITY_TYPES.filter((type) => isTaskEntity(task, type))).toEqual([kind])
    }
  })

  it("opens the search text tasks to a collection and a brand", () => {
    for (const task of [SEO_TITLE_TASK, SEO_DESCRIPTION_TASK, FOCUS_KEYWORD_TASK]) {
      expect(isTaskEntity(task, "collection")).toBe(true)
      expect(isTaskEntity(task, "brand")).toBe(true)
      expect(isTaskEntity(task, "media")).toBe(false)
    }
  })

  it("builds the layers: the page, the kind's craft, the option, the rules last", () => {
    for (const [task, kind, page] of TASKS) {
      const system = systemOf(task, "detailed", kind) ?? ""
      expect(system).toContain(page)
      expect(system).toContain("Seçilen ayar: Ayrıntılı yaz")
      expect(system.indexOf("Seçilen ayar")).toBeLessThan(system.indexOf(RULES_HEADING))
      expect(system).toContain(`en az ${String(MIN_LISTING_WORDS)}`)
      expect(system).toContain("başlık ve liste imi kullanma")
      expect(system).not.toMatch(/<[a-z]/i)
    }
    expect(systemOf(BRAND_DESCRIPTION_TASK, null, "brand")).toContain('"categories"')
    expect(systemOf(COLLECTION_DESCRIPTION_TASK, null, "collection")).toContain('"brands"')
    expect(systemOf(SEO_TITLE_TASK, null, "collection")).toContain("koleksiyon sayfasına")
    expect(systemOf(SEO_TITLE_TASK, null, "brand")).toContain("marka sayfasına")
  })

  it("takes the shop's guidance and the owner's craft like any prose task", () => {
    for (const [task, kind] of TASKS) {
      expect(isCraftTask(task.id)).toBe(true)
      const craft = defaultCraftOf(task.id)
      expect(craft?.craft).toContain("Yöntem:")
      const system = systemOf(
        task,
        "short",
        kind,
        "Mağazanın yönergesi: sıcak bir dil.",
        "Kendi talimatım."
      )
      expect(system).toContain(CRAFT_HEADING)
      expect(system).toContain("  Kendi talimatım.")
      expect(system).toContain("Mağazanın yönergesi")
      expect(system).not.toContain(craft?.craft ?? "-")
    }
    // One craft per kind: a shop may change the brand's alone
    expect(defaultCraftOf("brand_description")?.craft).not.toBe(
      defaultCraftOf("category_description")?.craft
    )
  })

  it("passes plain paragraphs over the listing floor, refuses a thin or marked up text", () => {
    const task = CATEGORY_DESCRIPTION_TASK
    expect(suggestionProblems(task, GOOD)).toEqual([])
    expect(suggestionProblems(task, PARAGRAPH)).toContain("too_short")
    expect(suggestionProblems(task, `${GOOD}\nBilgi: ayse.yilmaz@example.com`)).toContain(
      "personal_data"
    )
    expect(suggestionProblems(task, `${GOOD} https://ornek.com`)).toContain("link")
    expect(suggestionProblems(task, "a ".repeat(LISTING_DESCRIPTION_MAX_LENGTH))).toEqual([
      "length",
    ])
    // The word targets never go under the advisor's floor
    expect(LISTING_WORDS.min).toBe(MIN_LISTING_WORDS)
    expect(LISTING_WORDS.short).toBeGreaterThan(LISTING_WORDS.min)
  })

  it("tells the listing floor in the correction note, not a product's", () => {
    const note = correctionNote(
      CATEGORY_DESCRIPTION_TASK,
      [{ text: PARAGRAPH, problems: ["too_short"] }],
      ""
    )
    expect(note).toContain(`en az ${String(MIN_LISTING_WORDS)} sözcük`)
  })
})
