import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * A "row" ranked rail of five across between 1024 and 1279 px: each
 * photograph is ~130 px, so its actions leave the photograph's corner for
 * the place's foot and its pill is a row's size (fix 2026-11-16). Every
 * other width, a lead rail and a row rail of four or fewer across stand as
 * before.
 */

const SRC = path.resolve(import.meta.dirname, "../../../../../packages/themes/atolye/src")
const CSS = readFileSync(path.join(SRC, "ranked.css"), "utf8")

/** The body of the one block opened by `head` (braces counted). */
function blockOf(head: string): string {
  const start = CSS.indexOf(head)
  expect(start, head).toBeGreaterThan(-1)
  const open = CSS.indexOf("{", start)
  let depth = 0
  for (let at = open; at < CSS.length; at++) {
    if (CSS[at] === "{") depth++
    if (CSS[at] === "}") depth--
    if (depth === 0) {
      return CSS.slice(open + 1, at)
    }
  }
  throw new Error(`unclosed ${head}`)
}

describe("a row ranked rail of five across below 1280 px", () => {
  const block = blockOf("@media (64rem <= width < 80rem)")

  it("is only the row rails drawn five across", () => {
    expect(block).toMatch(
      /\.gf-ranked\[data-layout="row"\]:is\(\[data-count="5"\], \[data-count="9"\], \[data-count="10"\]\)\s*>\s*\.gf-rank\s*\{/
    )
    expect(block).not.toContain('data-layout="lead"')
    expect(CSS.match(/@media \(64rem <= width < 80rem\)/g)).toHaveLength(1)
  })

  it("moves the actions off the photograph to the place's foot, at its end, with no shadow", () => {
    expect(block).toContain('--rank-areas: "n photo" ". text" ". acts";')
    expect(block).toContain("--rank-tracks: auto auto 1fr;")
    expect(block).toContain("--rank-acts-justify: end;")
    expect(block).toContain("--rank-acts-position: static;")
    expect(block).toContain("--rank-acts-shadow: none;")
  })

  it("draws the pill a row's size", () => {
    expect(block).toContain("--rank-pill-pad: 2px 6px;")
    expect(block).toContain("--rank-pill-size: 0.6875rem;")
  })

  it("leaves every other place's tracks and actions as the browser's own", () => {
    const place = blockOf(".gf-rank {")
    expect(place).toContain("--rank-tracks: none;")
    expect(place).toContain("--rank-acts-justify: auto;")
    expect(blockOf(".gf-rank-card {")).toContain("grid-template-rows: var(--rank-tracks);")
    expect(blockOf(".gf-rank-acts {")).toContain("justify-self: var(--rank-acts-justify);")
  })
})
