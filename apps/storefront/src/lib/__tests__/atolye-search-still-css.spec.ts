import { describe, expect, it } from "vitest"
import { atolyeCss } from "@/test/atolye-css"

/** The stylesheet with its runs of white space as one (the formatter breaks long selectors). */
const FRAME_CSS = atolyeCss("frame.css").replace(/\s+/g, " ")

/**
 * Typing in the search never moves the page (owner 2026-11-20): while a
 * header or phone search field has the focus the window's top padding is
 * off (the browser scrolled the caret "into view" below it a step per
 * key, the field in the sticky header never getting there), and the
 * search's focus does not unfold the folded header. The field's side:
 * `atolye-search-still.spec.tsx`.
 */
describe("the search keeps the page still: the stylesheet", () => {
  it("drops the window's top padding while a header or phone search field has the focus", () => {
    expect(FRAME_CSS).toMatch(
      /html:has\(:is\(\[data-gf-head\], \[data-search-drop\]\) \[role="search"\] :focus\) \{ scroll-padding-top: 0;/
    )
  })

  it("keeps the folded header folded while the focus is in its search", () => {
    expect(FRAME_CSS).not.toContain(".gf-head:focus-within")
    const folds = FRAME_CSS.match(/html\[data-js-scroll="down"\]:not\( ?:has\([^{]*\{/g) ?? []
    expect(folds.length).toBe(4)
    for (const fold of folds) {
      expect(fold).toContain('.gf-head :focus:not([role="search"] *)')
    }
  })
})
