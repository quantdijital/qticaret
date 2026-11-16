import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import { MAIN_SECTION_IDS } from "../sections/main"

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const LEFT = { layout: "left", sticky: true } as const
const bar = { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] }
const text = (id: string) => ({ id, type: "help" })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the main sections (adr/0049 Ek 2026-11-14 §5, §7)", () => {
  it("reads a design stored without them with their defaults, the header bar from the theme", () => {
    const doc = withMainSections(
      readStoredLayout({ header: [bar], product: [text("metin00001")] }),
      {
        layout: "centered",
        sticky: false,
      }
    )

    expect(doc.header.map((section) => section.type)).toEqual(["announcement_bar", "header_bar"])
    expect(doc.header[1]).toEqual({
      id: MAIN_SECTION_IDS.header_bar,
      type: "header_bar",
      variant: "centered",
      sticky: false,
      menu_images: "submenus",
      search_style: "field",
      ...ALWAYS,
    })
    expect(doc.footer).toEqual([
      {
        id: MAIN_SECTION_IDS.footer_bar,
        type: "footer_bar",
        variant: "ledger",
        ...ALWAYS,
        // The footer's own settings read in with their defaults (adr/0049 Ek 2026-11-15)
        social: "text",
        payment_badges: [],
        back_to_top: false,
        back_to_top_side: "right",
        back_to_top_shape: "round",
        back_to_top_mobile: true,
        // The shop's name over its contact, as before (owner 2026-11-16)
        brand: "name",
      },
    ])
    expect(doc.product.map((section) => section.type)).toEqual(["product_main", "help"])
    expect(doc.category).toEqual([
      {
        id: MAIN_SECTION_IDS.category_main,
        type: "category_main",
        variant: "standard",
        by_variant: {},
        ...ALWAYS,
      },
    ])
  })

  it("maps the theme's left header to today's standard bar", () => {
    const doc = withMainSections(layoutDocument.parse({}), LEFT)
    expect(doc.header[0]).toMatchObject({ variant: "standard", sticky: true })
  })

  it("keeps the main sections a design holds, and reads the same twice", () => {
    const saved = withMainSections(layoutDocument.parse({}), { layout: "left", sticky: false })
    const again = withMainSections(layoutDocument.parse(saved), {
      layout: "centered",
      sticky: true,
    })

    expect(again).toEqual(saved)
    expect(again.header[0]).toMatchObject({ variant: "standard", sticky: false })
  })

  it("fills a stored main section's defaults (no variant, no by_variant)", () => {
    const doc = layoutDocument.parse({
      header: [{ id: "mainheader", type: "header_bar" }],
      category: [{ id: "maincategory", type: "category_main" }],
    })
    expect(doc.header[0]).toEqual({
      id: "mainheader",
      type: "header_bar",
      variant: "standard",
      sticky: true,
      menu_images: "submenus",
      search_style: "field",
      ...ALWAYS,
    })
    expect(doc.category[0]).toMatchObject({ variant: "standard", by_variant: {} })
  })

  it("refuses a main section hidden, scheduled, twice, or of a variant off its list", () => {
    const hidden = { id: "mainfooter", type: "footer_bar", visible: false }
    const dated = { id: "mainproduct", type: "product_main", ends_at: "2026-12-01T00:00:00Z" }
    expect(issues({ footer: [hidden] })).toContain("storefront_layout.section_invalid")
    expect(issues({ product: [dated] })).toContain("storefront_layout.section_invalid")
    expect(
      issues({
        product: [
          { id: "mainproduct", type: "product_main" },
          { id: "mainproduct2", type: "product_main" },
        ],
      })
    ).toContain("storefront_layout.section_duplicate")
    expect(
      issues({ header: [{ id: "mainheader", type: "header_bar", variant: "shrinking" }] })
    ).toContain("storefront_layout.section_invalid")
    expect(
      issues({ category: [{ id: "maincategory", type: "category_main", by_variant: { x: {} } }] })
    ).toContain("storefront_layout.section_invalid")
  })

  it("lets a main section take no slot of the product and category pages", () => {
    const twelve = Array.from({ length: 12 }, (_, at) =>
      text(`metin${String(at).padStart(5, "0")}`)
    )
    const main = { id: "mainproduct", type: "product_main" }
    expect(layoutDocument.safeParse({ product: [main, ...twelve] }).success).toBe(true)
    expect(issues({ product: [...twelve, text("metin99999")] })).toContain(
      "storefront_layout.section_invalid"
    )
  })

  it("takes the header bar beside both strips (the header group's limit is 5)", () => {
    const strip = { id: "kayan00001", type: "marquee", items: [{ text: "Kargo bedava" }] }
    const header = [bar, strip, { id: "mainheader", type: "header_bar" }]
    expect(layoutDocument.safeParse({ header }).success).toBe(true)
    expect(issues({ header: [...header, { ...bar, id: "duyuru0002" }] })).toContain(
      "storefront_layout.section_duplicate"
    )
  })

  it("reads a variant taken off the list (or a newer build's) as the default, and a dropped by_variant key", () => {
    const doc = readStoredLayout({
      header: [{ id: "mainheader", type: "header_bar", variant: "shrinking", sticky: false }],
      category: [
        { id: "maincategory", type: "category_main", by_variant: { showcase: { tabs: true } } },
      ],
    })
    expect(doc.header[0]).toMatchObject({ variant: "standard", sticky: false })
    expect(doc.category[0]).toMatchObject({ by_variant: {} })
  })

  it("gives the storefront each main section with its id and variant, a look only when set", () => {
    const doc = withMainSections(
      layoutDocument.parse({
        product: [{ id: "mainproduct", type: "product_main", look: { width: "narrow" } }],
      }),
      LEFT
    )
    const main = mainSectionsOf(doc)
    expect(main.header_bar).toEqual({
      id: "mainheader",
      type: "header_bar",
      variant: "standard",
      sticky: true,
      menu_images: "submenus",
      search_style: "field",
    })
    expect(main.footer_bar).toEqual({ id: "mainfooter", type: "footer_bar", variant: "ledger" })
    expect(main.product_main).toMatchObject({ variant: "standard", look: { width: "narrow" } })
    expect(main.category_main).toEqual({
      id: "maincategory",
      type: "category_main",
      variant: "standard",
      by_variant: {},
    })
  })
})
