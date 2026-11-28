import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ATOLYE_SOURCE, atolyeCss } from "@/test/atolye-css"

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      return sources(path)
    }
    return path.endsWith(".tsx") ? [path] : []
  })

/** What reads as an amount in a component's code, its words (string literals) left out. */
const AMOUNT = /price|total|amount|lira|money|paid|fee\b|cost|<Money|<Price/i

/**
 * Prices, totals and amounts are drawn in the body face (adr/0062 §7): two
 * of the heading faces a shop may choose carry no ₺. A heading (h1 to h3)
 * and the `font-display` utility are the only places the heading face is
 * set, so neither may hold an amount.
 */
describe("the face prices are drawn in", () => {
  const files = sources(ATOLYE_SOURCE)

  it("finds the theme's components", () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it("sets the heading face on headings, the shelf's tab row, the wordmark and a quote mark only", () => {
    const css = [
      "base.css",
      "ui.css",
      "tabs.css",
      "buy.css",
      "pages.css",
      "content.css",
      "frame.css",
    ]
      .map((name) => [name, atolyeCss(name).split("var(--font-display)").length - 1] as const)
      .filter(([, count]) => count > 0)
    expect(css).toEqual([
      ["base.css", 1],
      ["tabs.css", 1],
    ])
    const users = files.filter((file) => /\bfont-display\b/.test(readFileSync(file, "utf8")))
    // The wordmark, and the compact review card's opening quote mark (no amount)
    expect(users.map((file) => file.slice(ATOLYE_SOURCE.length))).toEqual([
      "frame/Wordmark.tsx",
      "sections/review-card.tsx",
    ])
  })

  it("holds no amount inside a heading", () => {
    const found: string[] = []
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      for (const [heading] of source.matchAll(/<(h[1-3])\b[\s\S]*?<\/\1>/g)) {
        const code = heading.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""')
        // A listing's "24 ürün" is a count of results, not an amount
        if (AMOUNT.test(code.replace("count: view.total", ""))) {
          found.push(`${file.slice(ATOLYE_SOURCE.length)}: ${heading.replace(/\s+/g, " ")}`)
        }
      }
    }
    expect(found).toEqual([])
  })
})
