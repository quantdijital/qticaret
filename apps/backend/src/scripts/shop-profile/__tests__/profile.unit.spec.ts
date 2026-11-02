import { pageBody, parseProfile } from "../profile"

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

describe("parseProfile", () => {
  const base = { format: "quant-shop-profile", version: 1 }
  const page = { handle: "hakkimizda", title: "Hakkımızda", file: "../sayfalar/hakkimizda.md" }

  it("reads the pages it no longer wants", () => {
    const profile = parseProfile({ ...base, pages: [page], retired_pages: ["satis-sozlesmesi"] })
    expect(profile.retired_pages).toEqual(["satis-sozlesmesi"])
    expect(parseProfile(base).retired_pages).toEqual([])
  })

  it("refuses a page that is both kept and retired, and a handle that is no handle", () => {
    expect(() => parseProfile({ ...base, pages: [page], retired_pages: ["hakkimizda"] })).toThrow(
      /hakkimizda is also a page/
    )
    expect(() => parseProfile({ ...base, retired_pages: ["../yasal"] })).toThrow(/retired_pages/)
  })
})
