import { SECTIONS, mergePatch } from "../sections"

describe("panel_layout section", () => {
  const { full, patch, defaults } = SECTIONS.panel_layout

  it("starts with the panel's default layout: nothing ordered, nothing hidden", () => {
    expect(full.parse(defaults)).toEqual({ product: { main: [], side: [], hidden: [] } })
  })

  it("keeps a product page's order and hidden parts", () => {
    const product = { main: ["general", "seo", "media"], side: ["advisor"], hidden: ["faq"] }
    const body = patch.parse({ product })
    expect(full.parse(mergePatch(defaults, body))).toEqual({ product })
  })

  it("refuses odd keys, overlong lists and unknown fields", () => {
    expect(() => patch.parse({ product: { main: ["<b>"] } })).toThrow()
    expect(() => patch.parse({ product: { main: Array(41).fill("seo") } })).toThrow()
    expect(() => patch.parse({ product: { main: [], extra: 1 } })).toThrow()
    expect(() => patch.parse({ orders: {} })).toThrow()
  })
})
