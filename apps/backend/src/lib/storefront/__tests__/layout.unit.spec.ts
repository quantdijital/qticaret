import { isShowing, layoutDocument } from "../layout"

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const QA = { question: "İade süresi ne kadar?", answer: "14 gün içinde iade edebilirsiniz." }
const faq = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "faq",
  items: [QA],
  ...more,
})
const related = (id: string, productIds: string[], more: Record<string, unknown> = {}) => ({
  id,
  type: "related_products",
  source: { kind: "manual", product_ids: productIds },
  ...more,
})
const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  ...ALWAYS,
  title: null,
  text: null,
  ...more,
})

describe("storefront layout document (adr/0049)", () => {
  it("fills what a section leaves out and keeps the groups apart", () => {
    const doc = layoutDocument.parse({ home: [{ id: "yazilar1", type: "posts" }] })
    expect(doc).toEqual({
      header: [],
      home: [{ id: "yazilar1", type: "posts", ...ALWAYS, title: null, limit: 3 }],
      footer: [],
      product: [],
      category: [],
      // The theme's shared settings: unset until written (adr/0049 Ek 2026-11-06)
      settings: {
        trust_badges: null,
        color_swatches: null,
        low_stock: null,
        theme: null,
        menus: null,
        preset: null,
      },
    })
  })

  it("reads the product and category pages' sections with their defaults", () => {
    const doc = layoutDocument.parse({
      product: [
        { id: "benzerler1", type: "related_products", source: { kind: "same_category" } },
        faq("sss001"),
      ],
      category: [
        { id: "guvence1", type: "trust_badges" },
        { id: "ustmetin1", type: "help", placement: "top" },
      ],
    })
    expect(doc.product).toEqual([
      {
        id: "benzerler1",
        type: "related_products",
        ...ALWAYS,
        title: null,
        source: { kind: "same_category" },
        limit: 8,
        columns: 3,
      },
      { ...faq("sss001"), ...ALWAYS, title: null },
    ])
    expect(doc.category).toEqual([
      // No variant saved: the default, today's strip (adr/0049 Ek 2026-11-14 §2)
      { id: "guvence1", type: "trust_badges", ...ALWAYS, variant: "strip", placement: "bottom" },
      { id: "ustmetin1", type: "help", ...ALWAYS, title: null, text: null, placement: "top" },
    ])
    expect(doc.home).toEqual([])
  })

  it("takes a FAQ of up to twelve questions with the shop's details in its answers", () => {
    const doc = layoutDocument.parse({
      home: [faq("sss001", { items: Array.from({ length: 12 }, () => QA) })],
      category: [faq("sss002", { items: [{ question: "Kargo?", answer: "{telefon} arayın" }] })],
    })
    expect(doc.home[0]).toMatchObject({ type: "faq" })
    expect(doc.category[0]).toMatchObject({ type: "faq", placement: "bottom" })
  })

  it("takes an image at the shop's storage address, plain http on a developer's machine", () => {
    for (const url of [
      "http://localhost:9000/static/kapak.webp",
      "https://cdn.magaza.example/kapak.webp",
      "/static/kapak.webp",
    ]) {
      const hero = { id: "giris01", type: "hero", image: { url, alt: null } }
      expect(layoutDocument.safeParse({ home: [hero] }).success).toBe(true)
    }
    const slide = { image: { url: "http://localhost:9000/static/afis.webp", alt: "Afiş" } }
    const banner = { id: "afis0001", type: "banner", slides: [slide] }
    expect(layoutDocument.safeParse({ home: [banner] }).success).toBe(true)
  })

  it("takes one featured product on the home page only (adr/0046 Ek 2026-11-05)", () => {
    const featured = { id: "yakin001", type: "featured_product", product_id: "prod_1" }
    expect(layoutDocument.parse({ home: [featured] }).home).toEqual([
      { ...featured, ...ALWAYS, title: null, text: null },
    ])
    expect(layoutDocument.safeParse({ product: [featured] }).success).toBe(false)
    expect(layoutDocument.safeParse({ home: [{ ...featured, product_id: "" }] }).success).toBe(
      false
    )
    expect(
      layoutDocument.safeParse({ home: [{ ...featured, text: "{bilinmeyen}" }] }).success
    ).toBe(false)
  })

  it("takes a sale rail and a best-seller rail over 7 to 365 days, 90 by default", () => {
    const rail = (id: string, source: Record<string, unknown>) => ({ id, type: "products", source })
    const doc = layoutDocument.parse({
      home: [
        rail("indirim01", { kind: "on_sale" }),
        rail("coksatan1", { kind: "best_sellers" }),
        rail("coksatan2", { kind: "best_sellers", days: 7 }),
        rail("coksatan3", { kind: "best_sellers", days: 365 }),
      ],
    })
    expect(doc.home.map((section) => "source" in section && section.source)).toEqual([
      { kind: "on_sale" },
      { kind: "best_sellers", days: 90 },
      { kind: "best_sellers", days: 7 },
      { kind: "best_sellers", days: 365 },
    ])
    for (const source of [
      { kind: "best_sellers", days: 6 },
      { kind: "best_sellers", days: 366 },
      { kind: "best_sellers", days: 30.5 },
      { kind: "on_sale", days: 30 },
    ]) {
      expect(layoutDocument.safeParse({ home: [rail("raf00001", source)] }).success).toBe(false)
    }
    // A page's related rail takes neither
    expect(
      layoutDocument.safeParse({
        product: [{ id: "benzer01", type: "related_products", source: { kind: "on_sale" } }],
      }).success
    ).toBe(false)
  })

  it("takes 3, 4 or 5 cards in a row on a product rail, 3 by default (adr/0049 Ek 2026-11-05)", () => {
    const rail = (id: string, more: Record<string, unknown> = {}) => ({
      id,
      type: "products",
      source: { kind: "newest" },
      ...more,
    })
    const doc = layoutDocument.parse({
      home: [rail("raf00001"), rail("raf00002", { columns: 4 }), rail("raf00003", { columns: 5 })],
      product: [{ id: "benzer01", type: "related_products", source: { kind: "same_category" } }],
    })
    expect(doc.home.map((section) => "columns" in section && section.columns)).toEqual([3, 4, 5])
    expect(doc.product[0]).toMatchObject({ columns: 3 })
    for (const columns of [2, 6, 4.5, "4", null]) {
      const refused = layoutDocument.safeParse({ home: [rail("raf00004", { columns })] })
      expect(refused.error?.issues[0]?.message).toBe("storefront_layout.section_invalid")
    }
    expect(
      layoutDocument.safeParse({
        product: [{ ...related("benzer02", ["prod_1"]), columns: 5 }],
      }).success
    ).toBe(true)
  })

  it("takes up to twelve chosen related products", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `prod_${String(index)}`)
    const doc = layoutDocument.parse({ product: [related("benzer01", ids)] })
    expect(doc.product[0]).toMatchObject({ source: { kind: "manual", product_ids: ids } })
  })

  it.each([
    ["an id used twice", { home: [help("ayniid1"), help("ayniid1")] }],
    [
      "two announcement bars",
      {
        header: [
          { id: "duyuru1", type: "announcement_bar", lines: ["a"] },
          { id: "duyuru2", type: "announcement_bar", lines: ["b"] },
        ],
      },
    ],
    [
      "an end before the start",
      {
        home: [
          help("kampanya1", { starts_at: "2026-02-01T00:00:00Z", ends_at: "2026-01-01T00:00:00Z" }),
        ],
      },
    ],
    [
      "an image from another host's protocol-relative address",
      {
        home: [{ id: "giris01", type: "hero", image: { url: "//evil.example/x.png", alt: null } }],
      },
    ],
    [
      "a script link",
      {
        home: [
          {
            id: "giris01",
            type: "hero",
            links: [{ kind: "url", url: "javascript:alert(1)", label: "x" }],
          },
        ],
      },
    ],
    ["an unknown shop detail", { home: [help("yardim1", { text: "{telfon}" })] }],
    ["a section type it does not know", { home: [{ id: "garip01", type: "html", html: "<b>" }] }],
    ["an id used on two pages", { home: [help("ayniid1")], product: [faq("ayniid1")] }],
    [
      "an id used on the product and the category page",
      { product: [faq("ayniid2")], category: [faq("ayniid2")] },
    ],
    ["a home section on a product page", { product: [{ id: "giris01", type: "hero" }] }],
    [
      "a type the product page does not know",
      { product: [{ id: "garip01", type: "html", html: "<b>" }] },
    ],
    [
      "related products on a category page",
      { category: [{ ...related("benzer01", ["prod_1"]), placement: "top" }] },
    ],
    ["a place on a product page", { product: [{ ...faq("sss001"), placement: "top" }] }],
    ["a place a category page has not", { category: [{ ...faq("sss001"), placement: "side" }] }],
    ["a FAQ without questions", { home: [faq("sss001", { items: [] })] }],
    [
      "a FAQ of thirteen questions",
      { home: [faq("sss001", { items: Array.from({ length: 13 }, () => QA) })] },
    ],
    [
      "a question over 160 characters",
      { home: [faq("sss001", { items: [{ ...QA, question: "a".repeat(161) }] })] },
    ],
    [
      "an answer over 600 characters",
      { product: [faq("sss001", { items: [{ ...QA, answer: "a".repeat(601) }] })] },
    ],
    [
      "an unknown shop detail in an answer",
      { category: [faq("sss001", { items: [{ ...QA, answer: "{telfon}" }] })] },
    ],
    [
      "thirteen chosen related products",
      {
        product: [
          related(
            "benzer01",
            Array.from({ length: 13 }, (_, index) => `prod_${String(index)}`)
          ),
        ],
      },
    ],
    ["no chosen related product", { product: [related("benzer01", [])] }],
    [
      "thirteen related products shown",
      { product: [related("benzer01", ["prod_1"], { limit: 13 })] },
    ],
    [
      "a related source it does not know",
      { product: [{ id: "benzer01", type: "related_products", source: { kind: "newest" } }] },
    ],
    [
      "thirteen product page sections",
      {
        product: Array.from({ length: 13 }, (_, index) =>
          faq(`sss${String(index).padStart(3, "0")}`)
        ),
      },
    ],
  ])("refuses %s", (_, doc) => {
    expect(layoutDocument.safeParse(doc).success).toBe(false)
  })

  it("shows a section while it is visible and within its dates", () => {
    const now = new Date("2026-11-02T12:00:00Z")
    expect(isShowing(ALWAYS, now)).toBe(true)
    expect(isShowing({ ...ALWAYS, visible: false }, now)).toBe(false)
    expect(isShowing({ ...ALWAYS, starts_at: "2026-11-03T00:00:00Z" }, now)).toBe(false)
    expect(isShowing({ ...ALWAYS, ends_at: "2026-11-02T12:00:00Z" }, now)).toBe(false)
    expect(
      isShowing(
        { visible: true, starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-30T00:00:00Z" },
        now
      )
    ).toBe(true)
  })
})
