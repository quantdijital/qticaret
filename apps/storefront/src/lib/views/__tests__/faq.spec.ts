import { describe, expect, it } from "vitest"
import { blocksOf, faqOf, faqOfRows } from "../faq"

// An FAQ's own rows by group (adr/0073 Ek 2026-11-24 (2)): as a text of questions was read
describe("faqOfRows", () => {
  it("groups the rows under their headings, a plain answer from before in a paragraph", () => {
    const view = faqOfRows(
      [
        { question: "Üye olmalı mıyım?", html: "<p>Hayır.</p>" },
        { heading: "Ödeme & İade" },
        { question: "Taksit?", answer: "3 taksit <değil>" },
        { heading: "Boş" },
        { heading: "Kargo" },
        { question: "Ne zaman?", html: "<p>Aynı gün.</p>" },
      ],
      new Set(["kargo"])
    )
    expect(view).toEqual({
      intro: "",
      groups: [
        {
          id: "sorular-1",
          title: null,
          lead: "",
          items: [{ question: "Üye olmalı mıyım?", html: "<p>Hayır.</p>" }],
        },
        {
          id: "odeme-iade",
          title: "Ödeme & İade",
          lead: "",
          items: [{ question: "Taksit?", html: "<p>3 taksit &lt;değil&gt;</p>" }],
        },
        // A heading with no question after it is left out; the anchor taken skips on
        {
          id: "kargo-2",
          title: "Kargo",
          lead: "",
          items: [{ question: "Ne zaman?", html: "<p>Aynı gün.</p>" }],
        },
      ],
    })
  })

  it("reads the same groups and anchors as the text of questions it came from", () => {
    const text =
      "<h3>Kargo</h3><p><strong>Ne zaman?</strong></p><p>Aynı gün.</p>" +
      "<p><strong>Nereden?</strong></p><p>İstanbul.</p><h3>Ödeme</h3>" +
      "<p><strong>Taksit?</strong></p><ul><li>3</li></ul>"
    const rows = [
      { heading: "Kargo" },
      { question: "Ne zaman?", html: "<p>Aynı gün.</p>" },
      { question: "Nereden?", html: "<p>İstanbul.</p>" },
      { heading: "Ödeme" },
      { question: "Taksit?", html: "<ul><li>3</li></ul>" },
    ]
    expect(faqOfRows(rows, new Set(["icerik"]))).toEqual(faqOf(text, new Set(["icerik"])))
  })
})

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
  it("keeps its groups' anchors clear of the ids the page has already", () => {
    const taken = new Set(["odeme", "yardim"])
    const faq = faqOf(BOLD, taken)
    expect(faq?.groups.map((group) => group.id)).toEqual(["nasil-satin-alirim", "odeme-2"])
    // The same text again on the page: none of its anchors met twice
    expect(faqOf(BOLD, taken)?.groups.map((group) => group.id)).toEqual([
      "nasil-satin-alirim-2",
      "odeme-3",
    ])
  })

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
