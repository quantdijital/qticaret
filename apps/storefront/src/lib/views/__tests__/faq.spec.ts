import { describe, expect, it } from "vitest"
import { blocksOf, faqOf } from "../faq"

// A questions page read from the shop's own HTML (adr/0046 Ek 2026-11-05 içerik sayfaları)
describe("blocksOf", () => {
  it("splits the HTML at its top-level elements, a list nested in a list kept whole", () => {
    const blocks = blocksOf('<p>Bir</p><ul><li>a<ul><li>b</li></ul></li></ul><h2 id="x">İki</h2>')
    expect(blocks.map((block) => block.tag)).toEqual(["p", "ul", "h2"])
    expect(blocks[1]?.outer).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>")
    expect(blocks[2]?.inner).toBe("İki")
  })
})

const BOLD =
  "<p>Giriş metni.</p>" +
  "<h2>Nasıl satın alırım?</h2>" +
  "<p><strong>Üye olmam gerekir mi?</strong></p><p>Hayır.</p>" +
  "<p><strong>Ne zaman kargoya verilir?</strong></p><p>Aynı gün.</p><p>Ya da ertesi gün.</p>" +
  "<h2>Ödeme</h2><p>Kısa not.</p>" +
  "<p><strong>Taksit var mı?</strong></p><ul><li>Evet</li></ul>"

describe("faqOf", () => {
  it("reads bold questions under their groups, a group heading ending in ? still a group", () => {
    const faq = faqOf(BOLD)
    expect(faq?.intro).toBe("<p>Giriş metni.</p>")
    expect(faq?.groups.map((group) => [group.id, group.title, group.lead])).toEqual([
      ["nasil-satin-alirim", "Nasıl satın alırım?", ""],
      ["odeme", "Ödeme", "<p>Kısa not.</p>"],
    ])
    expect(faq?.groups[0]?.items).toEqual([
      { question: "Üye olmam gerekir mi?", html: "<p>Hayır.</p>" },
      { question: "Ne zaman kargoya verilir?", html: "<p>Aynı gün.</p><p>Ya da ertesi gün.</p>" },
    ])
    expect(faq?.groups[1]?.items).toEqual([
      { question: "Taksit var mı?", html: "<ul><li>Evet</li></ul>" },
    ])
  })

  it("takes asking headings as the questions when no bold lines ask, the others as groups", () => {
    const faq = faqOf(
      "<h2>Kargo</h2><h3>Ne kadar sürer?</h3><p>1-4 gün.</p><h3>Ücret ne?</h3><p>Ücretsiz.</p>" +
        "<h2>İade</h2><h3>Süre ne?</h3><p>14 gün.</p>"
    )
    expect(faq?.groups.map((group) => group.title)).toEqual(["Kargo", "İade"])
    expect(faq?.groups[1]?.items).toEqual([{ question: "Süre ne?", html: "<p>14 gün.</p>" }])
  })

  it("puts questions before any heading in a group with no title", () => {
    const faq = faqOf(
      "<p><strong>Bir?</strong></p><p>a</p><p><strong>İki?</strong></p><p>b</p><p><strong>Üç?</strong></p><p>c</p>"
    )
    expect(faq?.intro).toBe("")
    expect(faq?.groups).toHaveLength(1)
    expect(faq?.groups[0]?.title).toBeNull()
    expect(faq?.groups[0]?.items).toHaveLength(3)
  })

  it("leaves an ordinary page alone: fewer than three questions, or bold lines that do not ask", () => {
    expect(faqOf("<h2>Biz kimiz?</h2><p>Atölye.</p><h2>Neden?</h2><p>Çünkü.</p>")).toBeNull()
    expect(
      faqOf(
        "<p><strong>Not</strong></p><p>a</p><p><strong>Uyarı</strong></p><p><strong>Bilgi</strong></p>"
      )
    ).toBeNull()
    expect(faqOf("")).toBeNull()
  })

  it("does not take a line with more than the bold words for a question", () => {
    const faq = faqOf(
      "<p><strong>Bir?</strong> ve devamı</p><p><strong>İki?</strong></p><p>b</p><p><strong>Üç?</strong></p><p>c</p><p><strong>Dört?</strong></p><p>d</p>"
    )
    expect(faq?.groups[0]?.items.map((item) => item.question)).toEqual(["İki?", "Üç?", "Dört?"])
    expect(faq?.intro).toBe("<p><strong>Bir?</strong> ve devamı</p>")
  })
})
