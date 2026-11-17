import { describe, expect, it, vi } from "vitest"
import type { StoreFooterSection, StoreLayout } from "@qticaret/types"

// The sections' own views are `sections.ts`'s (tested there): here, which go and in what order
vi.mock("../sections", () => ({
  sectionViews: vi.fn((sections: readonly { id: string }[]) =>
    Promise.resolve(sections.map((section) => ({ id: section.id })))
  ),
}))

const { footerNewsletterOf, footerSectionsOf } = await import("../footer-group")
const { sectionViews } = await import("../sections")
const t = (key: string) => key

const box = (variant?: string): StoreFooterSection =>
  ({
    id: "altbulten1",
    type: "newsletter",
    title: null,
    text: null,
    ...(variant ? { variant } : {}),
  }) as StoreFooterSection
const strip = { id: "altkayan01", type: "marquee", items: [] } as unknown as StoreFooterSection
const text: StoreFooterSection = { id: "altmetin01", type: "rich_text", title: null, html: "<p/>" }

const layout = (footer: StoreFooterSection[], variant?: string): StoreLayout =>
  ({
    header: [],
    home: [],
    product: [],
    category: [],
    footer,
    ...(variant ? { main: { footer_bar: { id: "mainfooter", variant } } } : {}),
  }) as unknown as StoreLayout

const ids = async (doc: StoreLayout) => (await footerSectionsOf(doc, t)).map((view) => view.id)

describe("the footer group's sections above the footer (adr/0070 §4)", () => {
  it("draws its rich text, badges and strip in the group's order; the box stays in the footer", async () => {
    expect(await ids(layout([strip, box(), text]))).toEqual(["altkayan01", "altmetin01"])
    expect(await ids(layout([text, box("split"), strip], "brand_columns"))).toEqual([
      "altmetin01",
      "altkayan01",
    ])
  })

  it("draws the free rows footer's box as a band in its place, never an in_footer one", async () => {
    expect(await ids(layout([strip, box("split"), text], "free_rows"))).toEqual([
      "altkayan01",
      "altbulten1",
      "altmetin01",
    ])
    expect(await ids(layout([box()], "free_rows"))).toEqual(["altbulten1"])
    expect(await ids(layout([box("in_footer"), text], "free_rows"))).toEqual(["altmetin01"])
  })

  it("asks for nothing when there is nothing to draw", async () => {
    vi.mocked(sectionViews).mockClear()
    expect(await ids(layout([box()]))).toEqual([])
    expect(sectionViews).not.toHaveBeenCalled()
  })

  it("finds the box wherever it stands in the group", () => {
    expect(footerNewsletterOf(layout([strip, text, box("strip")]))?.variant).toBe("strip")
    expect(footerNewsletterOf(layout([strip]))).toBeUndefined()
  })
})
