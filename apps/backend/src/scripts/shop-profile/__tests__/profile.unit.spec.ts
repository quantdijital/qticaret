import { pageBody } from "../profile"

describe("pageBody", () => {
  it("drops a captured page's source and meta lines before its rule", () => {
    const text = [
      "Kaynak: https://ornek.com/hakkimizda/",
      "",
      "> Sayfa başlığı (title): Hakkımızda",
      "> HTTP: 200",
      "",
      "---",
      "",
      "# HAKKIMIZDA",
      "Metin.",
    ].join("\n")

    expect(pageBody(text).trim()).toBe("# HAKKIMIZDA\nMetin.")
  })

  it("keeps a text whose rule is part of it, and one without a rule", () => {
    const ruled = "Giriş paragrafı\n\n---\n\nDevamı"
    expect(pageBody(ruled)).toBe(ruled)
    expect(pageBody("Yalnız metin")).toBe("Yalnız metin")
  })
})
