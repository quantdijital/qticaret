import { DESCRIPTION_CHARS, plainText, searchFields } from "../document"
import type { SearchSource } from "../document"

const source = (over: Partial<SearchSource> = {}): SearchSource => ({
  title: "Şef Bıçağı",
  codes: [],
  brand: null,
  categories: [],
  subtitle: null,
  attributes: [],
  options: [],
  variants: [],
  tags: [],
  type: null,
  description: null,
  ...over,
})

describe("a product as the index holds it (adr/0056)", () => {
  it("writes each weight's words as typed and as compared", () => {
    const text = searchFields(
      source({
        brand: "Çelik Usta",
        categories: ["Mutfak"],
        attributes: ["Paslanmaz Çelik", "20 cm"],
        options: ["Kırmızı", "Kırmızı"],
        variants: ["Kırmızı / L"],
        tags: ["hediye"],
        description: "<p>Keskin <b>bıçak</b> &amp; kılıf</p>",
      })
    )
    expect(text.fields.a).toEqual({ m: "şef bıçağı", f: "sef bicagi" })
    expect(text.fields.b).toEqual({ m: "çelik usta mutfak", f: "celik usta mutfak" })
    // Each word once in a field, however many variants repeat it
    expect(text.fields.c.m).toBe("paslanmaz çelik 20 cm kırmızı l hediye")
    expect(text.fields.d).toEqual({ m: "keskin bıçak kılıf", f: "keskin bicak kilif" })
    expect(text.title).toBe("sef bicagi")
  })

  it("holds the short description's words below the title's, above the description's", () => {
    const text = searchFields(
      source({
        tags: ["hediye"],
        summary: "Yıkanmış keten, rahat kesim. Sedef düğme.",
        description: "Keten kumaş",
      })
    )
    // C, after the tags: the shop's introduction ranks over the long text, never with the title
    expect(text.fields.c).toEqual({
      m: "hediye yıkanmış keten rahat kesim sedef düğme",
      f: "hediye yikanmis keten rahat kesim sedef dugme",
    })
    expect(text.fields.a.m).toBe("şef bıçağı")
    expect(text.fields.d.m).toBe("keten kumaş")
    expect(text.vocabulary.map(([norm]) => norm)).toContain("dugme")
    // None (an old row, a product without one) adds nothing
    expect(searchFields(source({ summary: null })).fields.c).toEqual({ m: "", f: "" })
  })

  it("finds a code as written and with its separators left out", () => {
    const text = searchFields(source({ codes: ["KUPA-MAVI-01", "8690000000001"] }))
    expect(text.fields.a.f).toBe("sef bicagi kupa mavi 01 kupamavi01 8690000000001")
    // Codes are not stemmed: the typed title alone
    expect(text.fields.a.m).toBe("şef bıçağı")
  })

  it("keeps each word once in the dictionary, a title's spelling first", () => {
    const text = searchFields(source({ title: "Kupa", categories: ["Şef"], tags: ["kupa"] }))
    expect(text.vocabulary).toEqual([
      ["kupa", "kupa", true],
      ["sef", "şef", false],
    ])
  })

  it("reads a description's text, its tags left out, a cut tag too, up to its limit", () => {
    expect(plainText("<p>Deri <b>kılıf</b> &amp; kayış</p>").replace(/\s+/g, " ").trim()).toBe(
      "Deri kılıf kayış"
    )
    const long = `${"a ".repeat(DESCRIPTION_CHARS)}<span class="x">b</span>`
    const read = plainText(long)
    expect(read.length).toBe(DESCRIPTION_CHARS)
    expect(read).not.toContain("span")
    expect(plainText(null)).toBe("")
  })
})
