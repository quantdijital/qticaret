import { SERP_TEXT_LENGTH } from "../../seo/pixel-width"
import { AI_ENTITY_TYPES } from "../facts"
import { suggestionProblems, suggestionText } from "../gate"
import { systemOf, isTaskOption } from "../instructions"
import { SEO_DESCRIPTION_TASK, SEO_TITLE_TASK, findAiTask } from "../registry/tasks"

/**
 * The search result title and description tasks (docs/22 PR 1-1): their
 * instruction (fixed, Turkish, free of any trade, lengths from the
 * advisor) and their gate (the advisor's rules for the field; what fails
 * is refused, never offered).
 */

const TITLE = "Keten Gömlek Yazlık Model ve Rahat Kesim | Örnek Mağaza"
const DESCRIPTION =
  "Nefes alan keten kumaştan yazlık gömlek. Rahat kesimi ve doğal dokusuyla her gün giyilebilir; ayrıntılar sayfada."

describe("SEO suggestion tasks (adr/0071 §2, §9)", () => {
  it("are real tasks for owners and admins, synchronous, one option at most", () => {
    for (const task of [SEO_TITLE_TASK, SEO_DESCRIPTION_TASK]) {
      expect(findAiTask(task.id, "production")).toBe(task)
      expect(task).toMatchObject({ capability: "text", mode: "sync", roles: ["owner", "admin"] })
      expect(task.options.length).toBeLessThanOrEqual(1)
      expect(task.gate).toBe(task.id)
    }
    expect(SEO_TITLE_TASK.maxLength).toBe(SERP_TEXT_LENGTH.title.max)
    expect(SEO_DESCRIPTION_TASK.maxLength).toBe(SERP_TEXT_LENGTH.description.max)
    expect(isTaskOption(SEO_DESCRIPTION_TASK, "short")).toBe(true)
    expect(isTaskOption(SEO_TITLE_TASK, "short")).toBe(false)
  })

  it("instructs with the advisor's length targets and names the kind of page", () => {
    const title = systemOf(SEO_TITLE_TASK, null, "product") ?? ""
    const description = systemOf(SEO_DESCRIPTION_TASK, "short", "category") ?? ""

    expect(title).toContain(`${String(SERP_TEXT_LENGTH.title.min)} ile`)
    expect(title).toContain(`${String(SERP_TEXT_LENGTH.title.max)} karakter`)
    expect(title).toContain("ürün sayfası")
    expect(description).toContain(`${String(SERP_TEXT_LENGTH.description.max)} karakter`)
    expect(description).toContain("kategori sayfası")
    expect(description).toContain("tek cümle")
    expect(systemOf(SEO_TITLE_TASK, null, "page")).toContain("içerik sayfası")
  })

  it("keeps every instruction free of a price and bound to the data", () => {
    for (const task of [SEO_TITLE_TASK, SEO_DESCRIPTION_TASK]) {
      for (const type of AI_ENTITY_TYPES) {
        const text = (systemOf(task, task.options[0] ?? null, type) ?? "").toLocaleLowerCase("tr")
        expect(text).not.toMatch(/₺|\btl\b|\d+[.,]\d{2}/)
        expect(text).toContain("yalnızca verideki bilgileri kullan")
      }
    }
  })

  it("passes a title and a description that keep to the advisor's rules", () => {
    expect(suggestionProblems(SEO_TITLE_TASK, TITLE)).toEqual([])
    expect(suggestionProblems(SEO_DESCRIPTION_TASK, DESCRIPTION)).toEqual([])
  })

  it("refuses what the advisor would flag, and what no suggestion may carry", () => {
    const title = (text: string) => suggestionProblems(SEO_TITLE_TASK, suggestionText(text))
    const description = (text: string) =>
      suggestionProblems(SEO_DESCRIPTION_TASK, suggestionText(text))

    expect(title("Kısa başlık")).toContain("length")
    expect(title(`${TITLE} ${TITLE}`)).toEqual(["length"])
    expect(description("Çok kısa bir açıklama.")).toContain("length")
    expect(title("KETEN GÖMLEK YAZLIK MODEL RAHAT KESİM ÖRNEK")).toContain("noise")
    expect(title("Keten Gömlek Keten Elbise Keten Pantolon Yazlık")).toContain("noise")
    expect(description(`${DESCRIPTION.slice(0, 90)} www.ornek-magaza.com.tr`)).toContain("link")
    expect(
      description("Bilgi ve sipariş için ayse.yilmaz@example.com adresine yazın, hemen dönelim.")
    ).toContain("personal_data")
    expect(title("<img src=x onerror=alert(1) Keten Gömlek Yazlık Model")).toContain("markup")
    expect(title("")).toEqual(["empty"])
  })
})
