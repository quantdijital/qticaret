import { SUMMARY_TEXT_MAX, summaryLength } from "../../../../catalog/summary"
import { renderDoc } from "../../../../content/render"
import { summaryFromExcerpt } from "../excerpt"
import { legacyExcerptLines, legacySummaries, legacySummaryDoc } from "../legacy-summary"
import { readWxr } from "../reader"
import { wxrFixture } from "./wxr"

const html = (excerpt: string, options = {}) => {
  const summary = summaryFromExcerpt(excerpt, options)
  return summary ? { html: renderDoc(summary.doc), cut: summary.cut } : null
}

describe("a WooCommerce excerpt as the short description, as written (adr/0055 Ek 2026-11-06)", () => {
  it("keeps paragraphs, line breaks, bold, italic and a list as the shop wrote them", () => {
    expect(
      html(
        "<p>El yapımı çakı, <strong>günlük</strong> <em>kullanım</em> için.<br>Kutusuyla gelir.</p>" +
          "<ul><li><strong>Toplam boy:</strong> 21 cm</li><li>Namlu: N690 çelik;</li></ul>"
      )
    ).toEqual({
      html:
        "<p>El yapımı çakı, <strong>günlük</strong> <em>kullanım</em> için.<br>Kutusuyla gelir.</p>" +
        "<ul><li><p><strong>Toplam boy:</strong> 21 cm</p></li><li><p>Namlu: N690 çelik;</p></li></ul>",
      cut: false,
    })
    // Sentences stay one paragraph: nothing is split into bullets
    expect(html("El yapımı kaşık. Kayın ağacından. 2 yıl garanti!")?.html).toBe(
      "<p>El yapımı kaşık. Kayın ağacından. 2 yıl garanti!</p>"
    )
  })

  it("holds the rest to the short slot: headings as h3, quotes and tables as text, no pictures", () => {
    expect(
      html(
        "<h2>Özellikler</h2><blockquote><p>Ömürlük.</p></blockquote>" +
          "<table><tr><th>Ölçü</th><td>28 cm</td></tr><tr><th>Ağırlık</th><td>1,5 kg</td></tr></table>" +
          "<img src='x.png'><p><a href='http://eski.example.com'>eski</a> " +
          "<a href='https://yeni.example.com/a'>yeni</a> <a href='https://site.example.com/bakim/'>bakım</a></p>",
        { siteHost: "site.example.com" }
      )?.html
    ).toBe(
      "<h3>Özellikler</h3><p>Ömürlük.</p><p>Ölçü: 28 cm<br>Ağırlık: 1,5 kg</p>" +
        '<p>eski <a href="https://yeni.example.com/a" rel="noopener noreferrer">yeni</a> <a href="/bakim">bakım</a></p>'
    )
  })

  it("cuts a text past 1,500 characters at the cap only, at a word or a whole item, and says so", () => {
    const long = summaryFromExcerpt(`<p>Giriş.</p><p>${"uzun kelime ".repeat(200)}</p>`)
    expect(long?.cut).toBe(true)
    const length = summaryLength(long?.doc.content ?? [])
    expect(length).toBeLessThanOrEqual(SUMMARY_TEXT_MAX)
    expect(length).toBeGreaterThan(SUMMARY_TEXT_MAX - 20)
    expect(renderDoc(long?.doc ?? { type: "doc", content: [] })).toMatch(
      / kelime…<\/p>$|uzun…<\/p>$/u
    )
    const items = Array.from(
      { length: 40 },
      (_, index) => `<li>${String(index).padStart(2, "0")} ${"x".repeat(47)}</li>`
    )
    const list = summaryFromExcerpt(`<ol>${items.join("")}</ol>`)
    expect(list?.cut).toBe(true)
    // 50 characters an item: 30 whole items
    expect(renderDoc(list?.doc ?? { type: "doc", content: [] }).match(/<li>/g)).toHaveLength(30)
    expect(summaryFromExcerpt("<p>Kısa.</p>")?.cut).toBe(false)
  })

  it("gives nothing for an excerpt without text, and drops hidden characters", () => {
    expect(summaryFromExcerpt("")).toBeNull()
    expect(summaryFromExcerpt("<p> </p><img src='x.png'>")).toBeNull()
    expect(html("<p>Gizli​ karakter</p>")?.html).toBe("<p>Gizli karakter</p>")
  })
})

describe("the 2026-11-05 build's lines, frozen for summary:backfill", () => {
  it("are what that build wrote of an excerpt", () => {
    expect(
      legacyExcerptLines(
        "<p>El yapımı çakı.</p><ul><li><strong>Toplam boy:</strong> 21 cm</li><li>Namlu: N690 çelik;</li></ul>",
        "Çakı"
      )
    ).toEqual(["Toplam boy: 21 cm", "Namlu: N690 çelik"])
    expect(legacyExcerptLines("El yapımı kaşık. Kayın ağacından. 2 yıl garanti!", "Kaşık")).toEqual(
      ["El yapımı kaşık", "Kayın ağacından", "2 yıl garanti!"]
    )
    const sentences = Array.from({ length: 6 }, (_, index) => `Cümle ${String(index + 1)}.`)
    expect(legacyExcerptLines(`<p>${sentences.join(" ")}</p>`, "")).toEqual(["Cümle 1"])
    expect(legacyExcerptLines("", "")).toEqual([])
  })

  it("as the list the column's change made of them, by the export's product keys", () => {
    expect(legacySummaryDoc(["A", "B"])).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: ["A", "B"].map((text) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          })),
        },
      ],
    })
    const found = legacySummaries(readWxr(wxrFixture("https://site.example.com")))
    expect(found.get("product:20")).toEqual(legacySummaryDoc(["El yapımı kaşık"]))
    expect(found.has("product:10")).toBe(false)
  })
})
