// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreMainSections } from "@qticaret/types"
import type { HeaderBarView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { headerBarOf } from "../views/main-sections"

/**
 * The one-row header over the opening (`header_bar` `inline`,
 * `over_cover`): marked only once switched on, read by that variant only,
 * and its stylesheet bound to the mark and to a page that opens with the
 * full photograph opening.
 */

const inline: HeaderBarView = { id: "mainheader", variant: "inline", sticky: true }

const header = (bar: HeaderBarView) => {
  const html = renderFrame(atolyeTheme, shopFixture({ headerBar: bar }))
  return new DOMParser().parseFromString(html, "text/html").querySelector("[data-gf-head]")
}

const BAR: StoreMainSections["header_bar"] = {
  id: "mainheader",
  type: "header_bar",
  variant: "inline",
  sticky: true,
}
const theme = { header: { layout: "left", sticky: true } } as const

describe("the one-row header over the opening", () => {
  it("is marked only while switched on", () => {
    expect(header({ ...inline, overCover: true })?.hasAttribute("data-over-cover")).toBe(true)
    expect(header(inline)?.hasAttribute("data-over-cover")).toBe(false)
  })

  it("is read for the one-row header only, and only when true", () => {
    const main = (bar: Partial<StoreMainSections["header_bar"]>) =>
      ({ header_bar: { ...BAR, ...bar } }) as StoreMainSections
    expect(headerBarOf(main({ over_cover: true }), theme).overCover).toBe(true)
    expect(headerBarOf(main({}), theme)).not.toHaveProperty("overCover")
    expect(headerBarOf(main({ over_cover: false }), theme)).not.toHaveProperty("overCover")
    expect(headerBarOf(main({ variant: "standard", over_cover: true }), theme)).not.toHaveProperty(
      "overCover"
    )
  })
})
