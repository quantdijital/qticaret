import { summaryFromExcerpt } from "../excerpt"

describe("a WooCommerce excerpt as the short description (adr/0055 Ek 2026-11-05)", () => {
  it("takes a list's items, the paragraph leading into it left out", () => {
    const html =
      "<p>El yapımı çakı, günlük kullanım için.</p><ul><li><strong>Toplam boy:</strong> 21 cm</li>" +
      "<li>Namlu: N690 çelik;</li><li>Kabza: Geyik boynuzu</li><li>Kilit: Sırttan kilitli.</li>" +
      "<li>Garanti: 2 yıl</li></ul>"
    expect(summaryFromExcerpt(html)).toEqual({
      lines: [
        "Toplam boy: 21 cm",
        "Namlu: N690 çelik",
        "Kabza: Geyik boynuzu",
        "Kilit: Sırttan kilitli",
        "Garanti: 2 yıl",
      ],
      partial: false,
    })
  })

  it("keeps a long list's first five items, a long item cut at a word, and says so", () => {
    const items = Array.from({ length: 7 }, (_, index) => `<li>Madde ${String(index + 1)}</li>`)
    expect(summaryFromExcerpt(`<ol>${items.join("")}</ol>`)).toEqual({
      lines: ["Madde 1", "Madde 2", "Madde 3", "Madde 4", "Madde 5"],
      partial: true,
    })
    const long = `<ul><li>${"uzun kelime ".repeat(12)}</li></ul>`
    const cut = summaryFromExcerpt(long)
    expect(cut?.partial).toBe(true)
    expect(cut?.lines[0]?.length).toBeLessThanOrEqual(90)
    // At a word: "… kelime uzun…", never a word broken
    expect(cut?.lines[0]).toMatch(/ kelime uzun…$/u)
  })

  it("reads a table's label and value rows as lines", () => {
    const html =
      "<table><tr><th>Ölçü</th><td>28 cm</td></tr><tr><th>Ağırlık</th><td>1,5 kg</td></tr></table>"
    expect(summaryFromExcerpt(html)?.lines).toEqual(["Ölçü: 28 cm", "Ağırlık: 1,5 kg"])
  })

  it("splits paragraphs at line breaks and sentences when they fit five short lines", () => {
    expect(
      summaryFromExcerpt("<p>Özellikler:<br>N690 çelik, 58-59 HRC<br>Geyik boynuzu sap</p>")
    ).toEqual({ lines: ["N690 çelik, 58-59 HRC", "Geyik boynuzu sap"], partial: false })
    expect(summaryFromExcerpt("El yapımı kaşık. Kayın ağacından. 2 yıl garanti!")).toEqual({
      lines: ["El yapımı kaşık", "Kayın ağacından", "2 yıl garanti!"],
      partial: false,
    })
    // A decimal or an ellipsis is no sentence's end
    expect(summaryFromExcerpt("<p>Ağırlık 1.5 kg... hafif</p>")?.lines).toEqual([
      "Ağırlık 1.5 kg... hafif",
    ])
  })

  it("keeps only the first sentence of a text that does not split cleanly", () => {
    const sentences = Array.from({ length: 6 }, (_, index) => `Cümle ${String(index + 1)}.`)
    expect(summaryFromExcerpt(`<p>${sentences.join(" ")}</p>`)).toEqual({
      lines: ["Cümle 1"],
      partial: true,
    })
    const long = `İlk cümle kısa. ${"Bu ikinci cümle doksan karakteri rahatça geçecek kadar uzun ".repeat(2)}.`
    expect(summaryFromExcerpt(long)).toEqual({ lines: ["İlk cümle kısa"], partial: true })
  })

  it("drops hidden characters and gives nothing for an excerpt without text", () => {
    expect(summaryFromExcerpt("<p>Gizli​ karakter</p>")?.lines).toEqual(["Gizli karakter"])
    expect(summaryFromExcerpt("")).toBeNull()
    expect(summaryFromExcerpt("<p> </p><img src='x.png'>")).toBeNull()
  })
})
