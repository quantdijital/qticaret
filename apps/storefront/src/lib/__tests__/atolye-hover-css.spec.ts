import { describe, expect, it } from "vitest"
import { atolyeCss } from "@/test/atolye-css"

/** A stylesheet with its runs of white space as one (the formatter breaks long selectors). */
const flat = (name: string) => atolyeCss(name).replace(/\s+/g, " ")
const FIELDS = flat("search-fields.css")
const HOVER = flat("hover.css")

/** The rules under one `@media` query, up to the next query or the end. */
function under(css: string, query: string): string {
  const start = css.indexOf(`@media ${query}`)
  if (start < 0) {
    throw new Error(`no @media ${query}`)
  }
  const next = css.indexOf("@media", start + 1)
  return css.slice(start, next < 0 ? undefined : next)
}

/**
 * The owner's interaction pass (2026-11-26): the search box's fields keep
 * no frame after a click, darken softly under a pointer and draw every
 * hairline the same; every clickable thing eases; the blended opening's
 * trust box lines up with its search box.
 */
describe("the search box's fields: the stylesheet", () => {
  it("is part of the theme, after the boxed fields it answers", () => {
    const styles = atolyeCss("styles.css")
    expect(styles.indexOf('@import "./search-fields.css";')).toBeGreaterThan(
      styles.indexOf('@import "./search-boxed.css";')
    )
    expect(styles).toContain('@import "./hover.css";')
  })

  it("drops a clicked field's frame and keeps the keyboard's ring", () => {
    expect(FIELDS).toContain(
      'form[role="search"] label:has(> svg):focus-within:not(:has(:focus-visible)), html[data-js-pointer] form[role="search"] label:has(> svg):focus-within { outline: none; }'
    )
  })

  it("darkens a field's ground under a pointer over 200 ms, at the inner radius", () => {
    expect(FIELDS).toContain("border-radius: var(--radius-inner);")
    expect(FIELDS).toContain("transition: background-color 200ms ease;")
    const hover = under(FIELDS, "(hover: hover)")
    expect(hover).toContain(
      'form[role="search"]:not([data-fields="boxed"]) label:has(> svg):hover::after'
    )
    expect(hover).toContain('[data-fields="boxed"] label:has(> svg):hover::before')
  })

  it("draws every hairline between fields as one straight full-height rule once the bar is a row", () => {
    for (const query of ["(width >= 48rem)", "(width >= 64rem)"]) {
      const row = under(FIELDS, query)
      expect(row).toContain("border-left-width: 0;")
      expect(row).toContain(
        "inset-block: 0; inset-inline-start: 0; width: 1px; background-color: var(--color-rule);"
      )
    }
    const wide = under(FIELDS, "(width >= 64rem)")
    // Boxed: the dates' group draws none of its own, each box's rule sits mid-gap
    expect(wide).toContain('[data-fields="boxed"] [role="group"] { border-left-width: 0; }')
    expect(wide).toContain("inset-inline-start: calc(-0.5rem - 0.5px);")
  })

  it("lines the blended opening's trust box up with its search box", () => {
    expect(FIELDS).toContain(
      '.gf-cover[data-side="blend"]:has(.gf-cover-body form[role="search"]) .gf-cover-foot > ul { width: 86%; margin-inline: 0; }'
    )
  })
})

describe("every clickable thing eases: the stylesheet", () => {
  it("eases colours by default under any element's own transition", () => {
    expect(HOVER).toContain(
      '@layer components { :where(a[href], button, summary, [role="tab"], label:has(> input[type="radio"])) {'
    )
    expect(HOVER).toContain("transition-duration: 200ms;")
  })

  it("lifts a category disc only for a visitor who has not asked for less motion", () => {
    const moving = under(HOVER, "(hover: hover) and (prefers-reduced-motion: no-preference)")
    expect(moving).toContain("transform: translateY(-2px) scale(1.04);")
    const still = under(HOVER, "(hover: hover)")
    expect(still).not.toContain("transform")
    expect(still).toContain('ul[data-variant="icons"] > li > a:hover > span:first-child')
  })

  it("keeps every transition between 150 and 250 ms", () => {
    const durations = [...`${FIELDS} ${HOVER}`.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]))
    expect(durations.length).toBeGreaterThan(0)
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(150)
      expect(ms).toBeLessThanOrEqual(250)
    }
  })
})
