import { descriptionOf } from "../../../migration/description"
import { factsFromBlocks } from "../extract"
import { definitionFacts, factsFromHtml, factsFromText, productFacts } from "../sources"

// What a WordPress body or a Shopify descriptionHtml becomes before it is stored (adr/0055)
const fromDoc = (html: string) => {
  const doc = descriptionOf(html, { shortcodes: false }).doc
  return doc ? factsFromBlocks(doc.content) : []
}
const pairs = (rows: { label: string; value: string }[]) =>
  rows.map((row) => [row.label, row.value])

describe("description facts: tables", () => {
  it("reads a two-column table under a heading, its column-name row skipped", () => {
    const rows = fromDoc(`
      <h2>Teknik Özellikler</h2>
      <table>
        <thead><tr><th>Özellik</th><th>Değer</th></tr></thead>
        <tbody>
          <tr><td>Malzeme</td><td>Paslanmaz çelik</td></tr>
          <tr><td>Uzunluk</td><td>22 cm</td></tr>
          <tr><td>Ağırlık</td><td></td></tr>
        </tbody>
      </table>`)
    expect(pairs(rows)).toEqual([
      ["Malzeme", "Paslanmaz çelik"],
      ["Uzunluk", "22 cm"],
    ])
    expect(rows[0]?.source_path).toBe("content.1.content.1")
  })

  it("reads a table whose labels are header cells, anywhere in the text", () => {
    const rows = fromDoc(`
      <p>Gün boyu kullanım için tasarlandı.</p>
      <table><tr><th>Ağırlık</th><td>180 gr</td></tr><tr><th>Renk</th><td>Lacivert</td></tr></table>`)
    expect(pairs(rows)).toEqual([
      ["Ağırlık", "180 gr"],
      ["Renk", "Lacivert"],
    ])
  })

  it("names a table's rows by a one-cell row above them", () => {
    const rows = fromDoc(`
      <table>
        <tr><td colspan="2"><strong>Gövde</strong></td></tr>
        <tr><td>Malzeme</td><td>Alüminyum</td></tr>
        <tr><td colspan="2">Kapak</td></tr>
        <tr><td>Malzeme</td><td>Cam</td></tr>
      </table>`)
    expect(rows.map((row) => [row.label, row.value, row.context])).toEqual([
      ["Malzeme", "Alüminyum", "Gövde"],
      ["Malzeme", "Cam", "Kapak"],
    ])
  })

  it("reads one header row over one row of values", () => {
    const rows = fromDoc(`
      <table>
        <tr><th>Genişlik</th><th>Yükseklik</th><th>Derinlik</th></tr>
        <tr><td>30 cm</td><td>20 cm</td><td>10 cm</td></tr>
      </table>`)
    expect(pairs(rows)).toEqual([
      ["Genişlik", "30 cm"],
      ["Yükseklik", "20 cm"],
      ["Derinlik", "10 cm"],
    ])
  })

  it("leaves a table of many columns and rows (a size chart) alone", () => {
    const rows = fromDoc(`
      <table>
        <tr><th>Beden</th><th>Göğüs</th><th>Bel</th></tr>
        <tr><td>S</td><td>90</td><td>70</td></tr>
        <tr><td>M</td><td>96</td><td>76</td></tr>
      </table>`)
    expect(rows).toEqual([])
  })

  it("takes a unit a label names in brackets", () => {
    const rows = fromDoc(`<table><tr><td>Uzunluk (cm)</td><td>22</td></tr></table>`)
    expect(rows).toEqual([
      { label: "Uzunluk", value: "22", unit: "cm", source_path: "content.0.content.0" },
    ])
  })
})

describe("description facts: lines under a heading", () => {
  it("reads bold labels with and without a colon under a bold heading line", () => {
    const rows = fromDoc(`
      <p><strong>Ürün Özellikleri</strong></p>
      <ul>
        <li><strong>Malzeme:</strong> Ceviz</li>
        <li><strong>Renk</strong> Kahverengi</li>
        <li>Garanti – 2 yıl</li>
      </ul>`)
    expect(pairs(rows)).toEqual([
      ["Malzeme", "Ceviz"],
      ["Renk", "Kahverengi"],
      ["Garanti", "2 yıl"],
    ])
  })

  it("reads lines broken inside one paragraph, the heading among them", () => {
    const rows = fromDoc(
      "<p><strong>Teknik Özellikler:</strong><br>Uzunluk: 22 cm<br>Ağırlık: 180 g</p>"
    )
    expect(rows.map((row) => [row.label, row.value, row.source_path])).toEqual([
      ["Uzunluk", "22 cm", "content.0.line.1"],
      ["Ağırlık", "180 g", "content.0.line.2"],
    ])
  })

  it("matches the heading whatever its case and Turkish letters", () => {
    for (const heading of ["TEKNİK ÖZELLİKLER", "teknik ozellikler", "Teknik özellikler:"]) {
      const rows = fromDoc(`<h3>${heading}</h3><p>Renk: Mavi</p>`)
      expect(pairs(rows)).toEqual([["Renk", "Mavi"]])
    }
  })

  it("names nested lists' facts by their parent item", () => {
    const rows = fromDoc(`
      <h3>Özellikler</h3>
      <ul>
        <li>Gövde<ul><li>Malzeme: Alüminyum</li><li>Renk: Gri</li></ul></li>
        <li>Kapak<ul><li>Malzeme: Cam</li></ul></li>
      </ul>`)
    expect(rows.map((row) => [row.label, row.value, row.context])).toEqual([
      ["Malzeme", "Alüminyum", "Gövde"],
      ["Renk", "Gri", "Gövde"],
      ["Malzeme", "Cam", "Kapak"],
    ])
    expect(rows[2]?.source_path).toBe("content.1.content.1.content.1.content.0")
  })

  it("ends the section at the next heading of its level", () => {
    const rows = fromDoc(`
      <h2>Özellikler</h2><p>Renk: Mavi</p>
      <h3>Ölçüler</h3><p>Boy: 40 cm</p>
      <h2>Teslimat</h2><p>Kargo: 2 iş günü</p>`)
    expect(rows.map((row) => [row.label, row.context ?? null])).toEqual([
      ["Renk", null],
      ["Boy", "Ölçüler"],
    ])
  })

  it("leaves a remark and a lone line outside a section", () => {
    const rows = fromDoc(`
      <p>Not: Ürün el yapımıdır, renk tonu değişebilir.</p>
      <p>Kullanım: günlük</p>
      <h2>Özellikler</h2>
      <p>Not: Elde yıkayın</p>
      <p>Renk: Mavi</p>`)
    expect(pairs(rows)).toEqual([["Renk", "Mavi"]])
  })

  it("takes a list or a run of lines that are all facts, with no heading", () => {
    const rows = fromDoc(`
      <p><strong>Malzeme:</strong> Pamuk</p>
      <p><strong>Renk:</strong> Beyaz</p>
      <p>Yumuşak dokusuyla her gün.</p>
      <ul><li>Boy: 70 cm</li><li>En: 50 cm</li></ul>
      <ul><li>Boy: 70 cm</li><li>Kolay bakım</li></ul>`)
    expect(pairs(rows)).toEqual([
      ["Malzeme", "Pamuk"],
      ["Renk", "Beyaz"],
      ["Boy", "70 cm"],
      ["En", "50 cm"],
    ])
  })
})

describe("description facts: HTML and plain text", () => {
  it("reads a definition list from HTML", () => {
    const html = "<dl><dt>Boyut</dt><dd>30 x 20 cm</dd><dt>Ağırlık</dt><dd>1,2 kg</dd></dl>"
    expect(pairs(definitionFacts(html))).toEqual([
      ["Boyut", "30 x 20 cm"],
      ["Ağırlık", "1,2 kg"],
    ])
    expect(pairs(factsFromHtml(html))).toEqual([
      ["Boyut", "30 x 20 cm"],
      ["Ağırlık", "1,2 kg"],
    ])
  })

  it("reads the plain text a document leaves in the description", () => {
    const text = [
      "Gün boyu kullanım için.",
      "",
      "Teknik Özellikler",
      "",
      "Malzeme: Ceviz",
      "Renk: Kahve",
      "",
      "Boy · 22 cm",
    ].join("\n")
    expect(pairs(factsFromText(text))).toEqual([
      ["Malzeme", "Ceviz"],
      ["Renk", "Kahve"],
      ["Boy", "22 cm"],
    ])
  })

  it("reads an older import's text, each item and row a paragraph of its own", () => {
    const text =
      "Kısa bir tanıtım.\n\n• Malzeme: Ceviz\n\n• Renk: Kahve\n\nUzunluk: 22 cm\n\nTeşekkürler."
    expect(pairs(factsFromText(text))).toEqual([
      ["Malzeme", "Ceviz"],
      ["Renk", "Kahve"],
      ["Uzunluk", "22 cm"],
    ])
  })

  it("reads the document first, then HTML, then plain text", () => {
    const doc = descriptionOf("<p>Renk: Mavi</p><p>Boy: 40 cm</p>").doc
    expect(productFacts({ doc, description: "x" }).source).toBe("doc")
    expect(productFacts({ doc: null, description: "<p>Renk: Mavi</p>" }).source).toBe("html")
    expect(productFacts({ doc: null, description: "Renk: Mavi\nBoy: 40" }).rows).toHaveLength(2)
    expect(productFacts({ doc: null, description: "" })).toEqual({ rows: [], source: null })
  })
})
