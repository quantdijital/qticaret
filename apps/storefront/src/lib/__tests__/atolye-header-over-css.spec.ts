import { describe, expect, it } from "vitest"
import { atolyeCss } from "@/test/atolye-css"

/** The one-row header over the opening's own rules (`header-over.css`): none reaches another header. */

describe("the over-the-opening header's stylesheet", () => {
  it("binds every rule to the mark and lets the page's scroll give the ground back", () => {
    const css = atolyeCss("header-over.css").replace(/\/\*[\s\S]*?\*\//g, "")
    const heads = css.split("{").filter((part) => part.includes(".gf-head"))
    expect(heads.length).toBeGreaterThan(0)
    expect(css).not.toMatch(/\.gf-head(?!\[data-over-cover\])[\s{:,]/)
    expect(css).toContain(":root:not([data-js-scroll])")
    expect(css).toContain('.gf-cover[data-side="full"]:not(.gf-section)')
  })

  it("shows the shop's dark-ground logo unfiltered, lightening only a logo without one", () => {
    const css = atolyeCss("header-over.css").replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /\.gf-wordmark:has\(\[data-gf-logo="dark"\]\)\s*\{\s*& \[data-gf-logo="light"\]\s*\{\s*display: none;/
    )
    expect(css).toMatch(/& \[data-gf-logo="dark"\]\s*\{\s*display: contents;/)
    expect(css).toMatch(
      /img:not\(\[data-gf-logo="dark"\] img\)\s*\{\s*filter: brightness\(0\) invert\(1\);/
    )
  })
})
