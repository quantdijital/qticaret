import { describe, expect, it } from "vitest"
import { atolyeCss } from "@/test/atolye-css"

/** The one-row header's own rules (`header-inline.css`): none reaches another header. */

describe("the one-row header's stylesheet", () => {
  const css = atolyeCss("header-inline.css")

  it("writes every rule under the variant's own mark", () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .slice(0, -1)
      .map((part) => part.split("}").at(-1)?.trim() ?? "")
      .filter((selector) => selector !== "" && !selector.startsWith("@media"))

    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      for (const each of selector.split(",")) {
        expect(each).toContain('.gf-head[data-variant="inline"]')
      }
    }
  })

  it("marks the page's link in the accent colour", () => {
    expect(css).toContain("color: var(--highlight)")
  })
})
