import { htmlToText } from "../text"

describe("a source's HTML description as text (F14)", () => {
  it("keeps paragraphs, breaks and list items, and reads the usual entities", () => {
    expect(
      htmlToText(
        "<p>Ağır <strong>döküm</strong> gövde.</p><p>Fırına girer&nbsp;&amp; ocakta kullanılır.<br>Garanti: 2 yıl</p><ul><li>24 cm</li><li>28 cm</li></ul>"
      )
    ).toBe(
      "Ağır döküm gövde.\nFırına girer & ocakta kullanılır.\nGaranti: 2 yıl\n\n• 24 cm\n• 28 cm"
    )
  })

  it("drops scripts, styles and comments, and a numeric entity that is no character", () => {
    expect(htmlToText("<script>alert(1)</script><style>p{}</style><!-- x -->Metin&#0;&#x41;")).toBe(
      "MetinA"
    )
    expect(htmlToText("   ")).toBeNull()
    expect(htmlToText(null)).toBeNull()
  })

  it("leaves a lone `<` as text", () => {
    expect(htmlToText("3 < 5 ve 7 > 2")).toBe("3 < 5 ve 7 > 2")
  })
})
