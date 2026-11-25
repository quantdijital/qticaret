import { SECTIONS, mergePatch } from "../sections"

describe("panel_layout section", () => {
  const { full, patch, defaults } = SECTIONS.panel_layout
  const save = (body: unknown) => full.parse(mergePatch(defaults, patch.parse(body)))

  it("starts with the panel's default layout: nothing ordered, hidden or open", () => {
    expect(full.parse(defaults)).toEqual({
      product: { main: [], side: [], hidden: [], open: [] },
    })
  })

  it("keeps a product page's order, hidden parts and parts that start open", () => {
    const product = {
      main: ["general", "seo", "media"],
      side: ["advisor"],
      hidden: ["faq"],
      open: ["seo"],
    }
    expect(save({ product })).toEqual({ product })
  })

  it("reads a layout saved before `open` as none open", () => {
    expect(full.parse({ product: { main: ["general"], side: [], hidden: [] } })).toEqual({
      product: { main: ["general"], side: [], hidden: [], open: [] },
    })
  })

  it("refuses odd keys, overlong lists and unknown fields", () => {
    expect(() => patch.parse({ product: { main: ["<b>"] } })).toThrow()
    expect(() => patch.parse({ product: { main: Array(41).fill("seo") } })).toThrow()
    expect(() => patch.parse({ product: { main: [], extra: 1 } })).toThrow()
    expect(() => patch.parse({ orders: {} })).toThrow()
  })

  it.each([
    ["twice in a column", { main: ["seo", "seo"], side: [], hidden: [], open: [] }],
    ["in both columns", { main: ["seo"], side: ["seo"], hidden: [], open: [] }],
    ["hidden twice", { main: [], side: [], hidden: ["faq", "faq"], open: [] }],
    ["open twice", { main: [], side: [], hidden: [], open: ["seo", "seo"] }],
  ])("refuses a part named %s", (_name, product) => {
    expect(() => save({ product })).toThrow(/platform_settings.layout_duplicate/)
  })

  it("lets a hidden or open part stand in its column too", () => {
    const product = { main: ["seo"], side: [], hidden: ["seo"], open: ["seo"] }
    expect(save({ product })).toEqual({ product })
  })
})
