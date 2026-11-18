import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { ATOLYE_SOURCE } from "@/test/atolye-css"

/**
 * The owner's hover rules (sahip 2026-11-18): no link takes an underline
 * under the pointer or on focus, in any look (a link in running text keeps
 * the underline it has at rest, WCAG 1.4.1; the focus ring stays); every
 * look shows the product's second photo on hover.
 */

const FILES: readonly string[] = readdirSync(ATOLYE_SOURCE, { recursive: true, encoding: "utf8" })
  .filter((file) => !file.includes("__tests__"))
  .sort()

const source = (file: string) => readFileSync(join(ATOLYE_SOURCE, file), "utf8")

/** A hover or focus utility that underlines (`hover:underline`, `group-hover/x:underline`…). */
const UNDERLINE_UTILITY = /\b[\w/-]*(?:hover|focus)[\w/:-]*:(?:underline|border-b)\b/g

/**
 * The `underline` menu style's own hover line is a choice the shop makes
 * (style kit, adr/0067), no look's; it is left to the shop that picks it.
 */
const CHOSEN = 'data-menu-style="underline"'

/**
 * Each innermost rule whose selectors all hover or focus and whose body
 * underlines; one that also names the link at rest keeps its own line on
 * focus, never adds one.
 */
function hoverUnderlines(css: string): string[] {
  const found: string[] = []
  for (const [, selector = "", body = ""] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const each = selector.split(",")
    if (!each.every((one) => /:(?:hover|focus)/.test(one)) || selector.includes(CHOSEN)) {
      continue
    }
    if (/text-decoration(?:-line)?:\s*underline|border-bottom(?:-width)?:/.test(body)) {
      found.push(selector.trim())
    }
  }
  return found
}

describe("no underline on hover (sahip 2026-11-18)", () => {
  it("leaves it out of every component's classes", () => {
    const found = FILES.filter((file) => file.endsWith(".tsx")).flatMap((file) =>
      (source(file).match(UNDERLINE_UTILITY) ?? []).map((utility) => `${file}: ${utility}`)
    )
    expect(found).toEqual([])
  })

  it("leaves it out of every stylesheet's hover and focus rules", () => {
    const found = FILES.filter((file) => file.endsWith(".css")).flatMap((file) =>
      hoverUnderlines(source(file)).map((selector) => `${file}: ${selector}`)
    )
    expect(found).toEqual([])
  })

  it("keeps a link in running text underlined at rest", () => {
    expect(source("content.css")).toMatch(/\.gf-prose a \{[^}]*text-decoration: underline;/)
    expect(source("footer-rows.css")).toMatch(
      /\.gf-foot-prose a \{[^}]*text-decoration: underline;/
    )
  })
})

describe("the second photo on hover in every look (sahip 2026-11-18)", () => {
  const PACKS = join(ATOLYE_SOURCE, "../../../sector-packs/packs")

  it("is on, or left to the default, in every look's theme", () => {
    const looks = readdirSync(PACKS)
      .filter((pack) => existsSync(join(PACKS, pack, "presets")))
      .flatMap((pack) =>
        readdirSync(join(PACKS, pack, "presets")).map((look) => join(PACKS, pack, "presets", look))
      )
    expect(looks.length).toBeGreaterThan(0)
    for (const look of looks) {
      const theme = JSON.parse(readFileSync(join(look, "theme.json"), "utf8")) as {
        product_card?: { hover_image?: boolean }
      }
      expect({ look, hover: theme.product_card?.hover_image ?? true }).toEqual({
        look,
        hover: true,
      })
    }
  })
})
