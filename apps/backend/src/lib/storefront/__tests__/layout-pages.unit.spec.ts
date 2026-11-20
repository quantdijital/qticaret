import path from "node:path"
import { bodySections, layoutDocument, readStoredLayout } from "../layout"
import { CONTENT_PAGE_SECTION_TYPES } from "../layout-pages"
import { LAYOUT_LIMITS } from "../layout-fields"
import { logger } from "../../logging"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-pages.ts"
)

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PAGE = "cnt_01KABOUT0000000000000000"
const OTHER = "cnt_01KCONTACT00000000000000"
const help = (id: string, more: Record<string, unknown> = {}) => ({ id, type: "help", ...more })
const strip = (id: string) => ({ id, type: "marquee", items: [{ text: "Aynı gün kargo" }] })
const page = (pageId: string, sections: unknown[]) => ({ page_id: pageId, sections })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("content pages' own sections (adr/0073 §1)", () => {
  it("reads a design from before pages with none, and a page's sections in their order", () => {
    expect(layoutDocument.parse({}).pages).toEqual([])
    const doc = layoutDocument.parse({
      pages: [
        page(PAGE, [
          help("ustyardim"),
          { id: "yazilar01", type: "posts" },
          { id: "guvence01", type: "trust_badges", variant: "lined" },
        ]),
      ],
    })
    // One list since Ek 2026-11-19 (2) K1: no place above or below the text
    expect(doc.pages).toEqual([
      {
        page_id: PAGE,
        sections: [
          { id: "ustyardim", type: "help", ...ALWAYS, title: null, text: null },
          { id: "yazilar01", type: "posts", ...ALWAYS, title: null, limit: 3 },
          { id: "guvence01", type: "trust_badges", ...ALWAYS, variant: "lined" },
        ],
      },
    ])
  })

  it("refuses a section's old place on a save (Ek 2026-11-19 (2) K1)", () => {
    expect(issues({ pages: [page(PAGE, [help("ustyardim", { placement: "top" })])] })).not.toEqual(
      []
    )
  })

  it("takes every type the contract lists, and the contract's list is the backend's", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CONTENT_PAGE_SECTION_TYPES).toEqual(contract["CONTENT_PAGE_SECTION_TYPES"])
    expect(contract["PAGE_LAYOUT_LIMITS"]).toEqual({
      pages: LAYOUT_LIMITS.pages,
      sections: LAYOUT_LIMITS.page,
    })
  })

  it("refuses the home page's opening and the header's and the footer's own types", () => {
    for (const section of [
      { id: "acilis001", type: "hero" },
      { id: "fiyatband1", type: "price_bands", bands: [] },
      { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] },
      { id: "benzer0001", type: "related_products", source: { kind: "same_category" } },
    ]) {
      expect(issues({ pages: [page(PAGE, [section])] })).toContain(
        "storefront_layout.section_invalid"
      )
    }
    // The newsletter's footer-only drawing is not a page's either
    expect(
      issues({
        pages: [page(PAGE, [{ id: "bulten0001", type: "newsletter", variant: "in_footer" }])],
      })
    ).not.toEqual([])
  })

  it("names a content page by its id only, each page once", () => {
    expect(issues({ pages: [page("/hakkimizda", [help("yardim001")])] })).toContain(
      "storefront_layout.page_invalid"
    )
    expect(issues({ pages: [page("prod_01KX", [help("yardim001")])] })).toContain(
      "storefront_layout.page_invalid"
    )
    expect(
      issues({ pages: [page(PAGE, [help("yardim001")]), page(PAGE, [help("yardim002")])] })
    ).toContain("storefront_layout.page_duplicate")
  })

  it("holds a page to one to twelve sections and the design to fifty pages", () => {
    expect(issues({ pages: [page(PAGE, [])] })).toContain("storefront_layout.page_sections_limit")
    const many = Array.from({ length: LAYOUT_LIMITS.page + 1 }, (_, n) =>
      help(`yardim${String(n + 100)}`)
    )
    expect(issues({ pages: [page(PAGE, many)] })).toContain("storefront_layout.page_sections_limit")
    const pages = Array.from({ length: LAYOUT_LIMITS.pages + 1 }, (_, n) =>
      page(`cnt_01KPAGE${String(n).padStart(3, "0")}`, [help(`yardim${String(n + 100)}`)])
    )
    expect(issues({ pages })).toContain("storefront_layout.pages_limit")
    expect(issues({ pages: pages.slice(0, LAYOUT_LIMITS.pages) })).toEqual([])
  })

  it("keeps a section's id unique across the home page and every page", () => {
    expect(
      issues({ home: [help("yardim001")], pages: [page(PAGE, [help("yardim001")])] })
    ).toContain("storefront_layout.section_duplicate")
    expect(
      issues({ pages: [page(PAGE, [help("yardim001")]), page(OTHER, [help("yardim001")])] })
    ).toContain("storefront_layout.section_duplicate")
  })

  it("counts the header's scrolling strip with a page's own (two at most)", () => {
    expect(
      issues({ header: [strip("ustserit01")], pages: [page(PAGE, [strip("serit0001")])] })
    ).toEqual([])
    expect(
      issues({
        header: [strip("ustserit01")],
        pages: [page(PAGE, [strip("serit0001"), strip("serit0002")])],
      })
    ).toContain("storefront_layout.marquee_limit")
  })

  it("refuses a design past a megabyte as a whole", () => {
    const answer = "Siparişiniz aynı gün kargoya verilir. ".repeat(15).trim().slice(0, 590)
    const faq = (id: string) => ({
      id,
      type: "faq",
      items: Array.from({ length: LAYOUT_LIMITS.faq }, (_, n) => ({
        question: `Soru ${String(n + 1)}?`,
        answer,
      })),
    })
    const pages = Array.from({ length: 12 }, (_, p) =>
      page(
        `cnt_01KBIG${String(p).padStart(3, "0")}`,
        Array.from({ length: LAYOUT_LIMITS.page }, (_, n) => faq(`sss${String(p)}x${String(n)}x00`))
      )
    )
    expect(issues({ pages })).toEqual(["storefront_layout.too_large"])
    expect(issues({ pages: pages.slice(0, 2) })).toEqual([])
  })

  it("checks a page's sections as every body section (records, images, rich text)", () => {
    const doc = layoutDocument.parse({
      home: [help("anayardim")],
      pages: [page(PAGE, [help("sayfayardim")])],
    })
    expect(bodySections(doc).map((section) => section.id)).toEqual(["anayardim", "sayfayardim"])
  })
})

describe("a stored design's page layouts (adr/0073 §1)", () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it("reads a page's sections forgivingly: an unknown one skipped, an emptied page left out", () => {
    const doc = readStoredLayout({
      pages: [
        page(PAGE, [help("yardim001"), { id: "gelecekbolum", type: "future_section" }]),
        page(OTHER, [{ id: "acilis001", type: "hero" }]),
        { page_id: "not a page", sections: [help("yardim002")] },
        "broken row",
      ],
    })
    expect(doc.pages.map((each) => each.page_id)).toEqual([PAGE])
    expect(doc.pages[0]?.sections.map((section) => section.id)).toEqual(["yardim001"])
    const [fields] = warn.mock.calls[0] as [Record<string, unknown>]
    expect(fields["sections"]).toEqual([
      { group: `pages.${PAGE}`, id: "gelecekbolum", type: "future_section" },
      { group: `pages.${OTHER}`, id: "acilis001", type: "hero" },
    ])
  })

  it("reads a page stored past today's limits: the first pages and sections, never a failure", () => {
    // As a design saved under a higher limit, a lower one since
    const sections = Array.from({ length: LAYOUT_LIMITS.page + 3 }, (_, n) =>
      help(`yardim${String(n + 100)}`)
    )
    const pages = Array.from({ length: LAYOUT_LIMITS.pages + 2 }, (_, n) =>
      page(
        `cnt_01KOLD${String(n).padStart(3, "0")}`,
        n === 0 ? sections : [help(`tek${String(n + 100)}x`)]
      )
    )
    const doc = readStoredLayout({ pages })
    expect(doc.pages).toHaveLength(LAYOUT_LIMITS.pages)
    expect(doc.pages[0]?.sections.map((section) => section.id)).toEqual(
      sections.slice(0, LAYOUT_LIMITS.page).map((section) => section.id)
    )
  })
})
