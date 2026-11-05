import { assess, findIssues, gradeOf, scoreIssues } from "../engine"
import { isShouting, repeatedWord } from "../text"
import type { AdvisorFacts } from "../types"

const BODY = Array.from({ length: 160 }, (_, index) =>
  index % 10 === 0 ? "keten" : "kelime"
).join(" ")

type ProductFacts = NonNullable<AdvisorFacts["product"]>

const PRODUCT: ProductFacts = {
  images: 4,
  imagesWithoutAlt: 0,
  variants: 2,
  unpriced: 0,
  unidentified: 0,
  brand: "Örnek Marka",
  categories: 1,
  primaryCategory: true,
  physical: true,
  missingDimensions: false,
  missingAttributes: [],
}

const good = (overrides: Partial<AdvisorFacts> = {}): AdvisorFacts => ({
  kind: "product",
  name: "Keten Gömlek",
  handle: "keten-gomlek",
  title: "Keten Gömlek - Beyaz, Rahat Kesim | Örnek Marka",
  titleIsOwn: false,
  description:
    "Yıkanmış ketenden rahat kesim gömlek. Nefes alan kumaşı ile yaz için ideal; 899,00 TL'den başlayan fiyatlarla.",
  descriptionIsOwn: false,
  body: BODY,
  bodyHtml: `<p>${BODY}</p>`,
  focusKeyword: null,
  duplicates: { title: 0, description: 0 },
  noindex: false,
  product: PRODUCT,
  ...overrides,
})

const ids = (facts: AdvisorFacts) => findIssues(facts).map((issue) => issue.ruleId)

describe("the advisor", () => {
  it("finds nothing on a complete product page and scores it 100", () => {
    expect(assess(good())).toMatchObject({ score: 100, grade: "excellent", issues: [] })
  })

  it("lists what a thin product page misses, most severe first", () => {
    const facts = good({
      title: "GÖMLEK GÖMLEK GÖMLEK!!",
      titleIsOwn: true,
      description: "Gömlek.",
      body: "Güzel gömlek.",
      bodyHtml: '<h1>Gömlek</h1><img src="http://cdn.example.com/a.jpg">',
      handle: "urun-123",
      product: {
        ...PRODUCT,
        images: 0,
        unpriced: 1,
        unidentified: 2,
        brand: null,
        primaryCategory: false,
        missingDimensions: true,
        missingAttributes: ["Malzeme", "Boyut"],
      },
    })
    const found = findIssues(facts)
    expect(found.slice(0, 2).map(({ ruleId, severity }) => [ruleId, severity])).toEqual([
      ["P-DATA-01", "critical"],
      ["P-IMG-01", "critical"],
    ])
    expect(found.map(({ ruleId }) => ruleId)).toEqual(
      expect.arrayContaining([
        "P-TITLE-01",
        "P-TITLE-03",
        "P-META-01",
        "P-SLUG-02",
        "P-CONT-01",
        "P-CONT-03",
        "P-CONT-04",
        "P-CONT-07",
        "P-DATA-02",
        "P-DATA-03",
        "P-DATA-04",
        "P-DATA-05",
      ])
    )
    // An own title that misses can go back to the template in one click
    expect(found.find(({ ruleId }) => ruleId === "P-TITLE-01")?.fix).toEqual({
      kind: "auto",
      action: "use_template_title",
    })
    const result = assess(facts)
    expect(result.grade).toBe("poor")
    expect(result.categories).toMatchObject({ structured: 0, images: 0 })
  })

  it("hints at a missing short description without costing the score (adr/0055 Ek 2026-11-05)", () => {
    const empty = good({ product: { ...PRODUCT, summary: 0 } })
    expect(findIssues(empty)).toEqual([
      expect.objectContaining({
        ruleId: "P-CONT-09",
        severity: "info",
        fix: { kind: "manual", action: "edit_summary" },
      }),
    ])
    expect(assess(empty).score).toBe(100)
    expect(ids(good({ product: { ...PRODUCT, summary: 3 } }))).not.toContain("P-CONT-09")
    // A sheet's row does not say: no hint
    expect(ids(good())).not.toContain("P-CONT-09")
  })

  it("scores the same page the same way every time", () => {
    const facts = good({ product: { ...PRODUCT, images: 1 } })
    expect(assess(facts)).toEqual(assess(facts))
    // One medium finding takes a quarter of the images weight: 20 × 0.25 = 5
    expect(assess(facts).score).toBe(95)
  })

  it("checks a chosen focus keyword in the title, description and opening", () => {
    const issue = findIssues(good({ focusKeyword: "keten gömlek" })).find(
      ({ ruleId }) => ruleId === "P-KW-01"
    )
    expect(issue?.params["missing"]).toBe("description,body")
  })

  it("judges a category on its text, products and depth only", () => {
    const category = good({
      kind: "category",
      name: "Gömlek",
      handle: "gomlek",
      title: "Gömlek Modelleri ve Fiyatları | Demo Mağaza",
      body: "Kısa metin.",
      product: undefined,
      listing: { products: 0, depth: 4, hasLogo: false },
    })
    expect(ids(category)).toEqual(["C-EMPTY-01", "C-CONT-01", "C-DEPTH-01"])
    // Products, images and links weigh nothing for a category: 45 points apply
    expect(scoreIssues("category", []).categories).toEqual({ meta: 15, content: 20, technical: 10 })
  })

  it("names a brand without a logo", () => {
    const brand = good({
      kind: "brand",
      name: "Örnek Marka",
      handle: "ornek-marka",
      title: "Örnek Marka Ürünleri ve Fiyatları | Demo Mağaza",
      product: undefined,
      listing: { products: 3, depth: 1, hasLogo: false },
    })
    expect(ids(brand)).toEqual(["B-LOGO-01"])
  })
})

describe("advisor text checks", () => {
  it("hears shouting and repetition", () => {
    expect(isShouting("ŞEF BIÇAĞI İNDİRİMDE")).toBe(true)
    expect(isShouting("Şef Bıçağı 20 cm")).toBe(false)
    expect(repeatedWord("bıçak bıçak seti bıçak")).toBe("bıçak")
  })

  it("grades by the documented bands", () => {
    expect([95, 90, 89, 70, 69, 50, 49].map(gradeOf)).toEqual([
      "excellent",
      "excellent",
      "good",
      "good",
      "needs_work",
      "needs_work",
      "poor",
    ])
  })

  it("asks for alt text on images that have none (P-IMG-02)", () => {
    const issues = findIssues(good({ product: { ...PRODUCT, images: 3, imagesWithoutAlt: 2 } }))
    expect(issues.find(({ ruleId }) => ruleId === "P-IMG-02")).toEqual({
      ruleId: "P-IMG-02",
      severity: "medium",
      category: "images",
      params: { count: 2, total: 3 },
      fix: { kind: "manual", action: "add_alt_text" },
    })
    expect(findIssues(good()).some(({ ruleId }) => ruleId === "P-IMG-02")).toBe(false)
  })

  it("assesses a long page in well under 50 ms at the 95th percentile (F3 KK)", () => {
    // A 5,000-word description with headings, images and a focus keyword
    const words = Array.from({ length: 5000 }, (_, index) =>
      index % 25 === 0 ? "keten" : `kelime${String(index % 300)}`
    )
    const html = Array.from(
      { length: 50 },
      (_, part) =>
        `<h2>Bölüm ${String(part)}</h2><p>${words.slice(part * 100, part * 100 + 100).join(" ")}</p><img src="https://cdn.example.com/${String(part)}.jpg" alt="">`
    ).join("")
    const facts = good({ body: words.join(" "), bodyHtml: html, focusKeyword: "keten gömlek" })
    const times: number[] = []
    for (let run = 0; run < 200; run++) {
      const started = performance.now()
      assess(facts)
      times.push(performance.now() - started)
    }
    const p95 = [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)] ?? Infinity
    expect(p95).toBeLessThan(50)
  })
})
