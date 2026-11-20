import { describe, expect, it } from "vitest"
import { anchorOf, withOutline } from "../legal-outline"
import { pageAnchors } from "../page-anchors"

// A legal text's table of contents: its h2s anchored by their own words
describe("withOutline", () => {
  it("gives every h2 an id from its words and lists them in order", () => {
    const { html, outline } = withOutline(
      "<h2>1. Taraflar</h2><p>Satıcı</p><h2>7. Cayma Hakkı</h2><h3>Alt</h3>"
    )
    expect(outline).toEqual([
      { id: "1-taraflar", label: "1. Taraflar" },
      { id: "7-cayma-hakki", label: "7. Cayma Hakkı" },
    ])
    expect(html).toBe(
      '<h2 id="1-taraflar">1. Taraflar</h2><p>Satıcı</p><h2 id="7-cayma-hakki">7. Cayma Hakkı</h2><h3>Alt</h3>'
    )
  })

  it("reads entities and inner tags for the words, and keeps the text as the backend wrote it", () => {
    const { html, outline } = withOutline(
      "<h2>Ödeme &amp; <strong>İade</strong> &#39;şartları&#39;</h2>"
    )
    expect(outline).toEqual([{ id: "odeme-iade-sartlari", label: "Ödeme & İade 'şartları'" }])
    expect(html).toBe(
      '<h2 id="odeme-iade-sartlari">Ödeme &amp; <strong>İade</strong> &#39;şartları&#39;</h2>'
    )
  })

  it("makes a heading's id unique, keeps one it already has and skips an empty one", () => {
    const { outline } = withOutline(
      '<h2>Genel</h2><h2>Genel</h2><h2 id="kendi">Kendi</h2><h2> </h2><h2>!!!</h2>'
    )
    expect(outline.map((item) => item.id)).toEqual(["genel", "genel-2", "kendi", "bolum-4"])
  })

  it("keeps the page's anchors apart across its texts, and clear of the theme's own ids", () => {
    const taken = pageAnchors()
    const first = withOutline("<h2>Genel</h2><h2>İçerik</h2><h2>Künye</h2>", taken)
    const second = withOutline('<h2>Genel</h2><h2 id="icerik">Ana</h2><h2>İçindekiler</h2>', taken)
    expect(first.outline.map((item) => item.id)).toEqual(["genel", "icerik-2", "kunye-2"])
    expect(second.outline.map((item) => item.id)).toEqual(["genel-2", "ana", "icindekiler-2"])
    // A heading's own id the page has already is written anew, once
    expect(second.html).toBe(
      '<h2 id="genel-2">Genel</h2><h2 id="ana">Ana</h2><h2 id="icindekiler-2">İçindekiler</h2>'
    )
  })

  it("takes no own id with the theme's `--`, kept for its later sections' ids", () => {
    expect(withOutline('<h2 id="icindekiler--2">Ek</h2>').outline).toEqual([
      { id: "ek", label: "Ek" },
    ])
  })

  it("leaves a text without h2s as it is", () => {
    expect(withOutline("<p>Tek paragraf</p>")).toEqual({ html: "<p>Tek paragraf</p>", outline: [] })
  })
})

describe("anchorOf", () => {
  it("folds the Turkish letters and keeps letters and digits only", () => {
    expect(anchorOf("Kişisel Verilerin İşlenmesi ve Çerezler")).toBe(
      "kisisel-verilerin-islenmesi-ve-cerezler"
    )
    expect(anchorOf("ĞÜŞIÖÇ ğüşıöç")).toBe("gusioc-gusioc")
  })
})
