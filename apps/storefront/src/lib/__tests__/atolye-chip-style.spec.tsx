import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { InstallmentFamilyView, ProductPageView } from "@qticaret/ui"
import { atolyeCss, ruleBody } from "@/test/atolye-css"
import { Pager } from "../../../../../packages/themes/atolye/src/listing/Pager"
import { Headline } from "../../../../../packages/themes/atolye/src/product/Headline"
import { InstallmentPlans } from "../../../../../packages/themes/atolye/src/product/InstallmentPlans"
import { Options } from "../../../../../packages/themes/atolye/src/product/Options"
import { installmentWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The chip family's grounds in one stylesheet (adr/0067 step 3, S3):
 * the pills the markup used to paint with utilities now name a theme
 * class, and the class gives the very values the utilities gave, so the
 * drawing stays (§3a, "yalnız taşıma").
 */

const t = (key: string) => key
const chips = atolyeCss("chips.css")
/** Classes that painted a pill's ground in the markup before the move. */
const GROUND_UTILITIES =
  /\b(?:hover:)?bg-paper-[23]\b|has-\[:checked\]:(?:bg-mark|text-mark-ink)|\bbg-text\b/

const classesOf = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}[^>]*class="([^"]*)"`, "g"))].map((found) => found[1] ?? "")

describe("the chip family's grounds (adr/0067 step 3a)", () => {
  it("draws a product's option values as theme pills, their ground the stylesheet's", () => {
    const html = renderToStaticMarkup(
      <Options
        options={[{ id: "boy", title: "Boy", values: ["15 cm", "20 cm"] }]}
        chosen={{ boy: "15 cm" }}
        choose={() => undefined}
        soldOut={(_, value) => value === "20 cm"}
        soldOutLabel="Tükendi"
      />
    )
    const labels = classesOf(html, "label")
    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label).toMatch(/\bgf-pill\b/)
      expect(label).not.toMatch(GROUND_UTILITIES)
    }
    // A sold-out value keeps its struck, quieter words, the chosen one its light ink
    expect(labels[1]).toContain("text-text-3 line-through")
    expect(labels[1]).toContain("has-[:checked]:text-paper")
  })

  it("draws the installment programs as the same pills", () => {
    const family = (name: string): InstallmentFamilyView => ({
      family: name,
      options: [{ count: 3, perInstallment: "100 TL", total: "300 TL" }],
    })
    const html = renderToStaticMarkup(
      <InstallmentPlans
        families={[family("Bonus"), family("World")]}
        first="Bonus"
        words={installmentWords(t)}
      />
    )
    const labels = classesOf(html, "label")
    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label).toMatch(/\bgf-pill\b/)
      expect(label).not.toMatch(GROUND_UTILITIES)
    }
  })

  it("draws a listing's page numbers as one class, the current page by its aria-current", () => {
    const html = renderToStaticMarkup(
      <Pager
        pagination={{
          page: 2,
          pages: 3,
          previous: "/kategori/caki",
          next: "/kategori/caki?sayfa=3",
          pagePath: {
            1: "/kategori/caki",
            2: "/kategori/caki?sayfa=2",
            3: "/kategori/caki?sayfa=3",
          },
        }}
        t={t}
      />
    )
    const numbers = [...html.matchAll(/<a [^>]*aria-label="listing\.page_n"[^>]*>/g)].map(
      (found) => found[0]
    )
    expect(numbers).toHaveLength(3)
    for (const number of numbers) {
      expect(number).toMatch(/class="gf-page-link /)
      expect(number).not.toMatch(GROUND_UTILITIES)
    }
    expect(numbers.filter((number) => number.includes('aria-current="page"'))).toHaveLength(1)
    // The previous and next steps stay quiet buttons, outside the family
    expect(html).toMatch(/rel="prev" class="gf-btn gf-btn--quiet/)
  })

  it("draws a product's headline facts on the fact pill", () => {
    const view = {
      title: "Çakı",
      brand: null,
      subtitle: null,
      summaryHtml: null,
      reviews: { average: null, count: 0 },
      specs: [{ label: "Çelik", value: "N690", highlight: true }],
    } as unknown as ProductPageView
    const html = renderToStaticMarkup(<Headline view={view} t={t} />)
    expect(html).toContain('<div class="gf-fact rounded-pill px-3 py-1.5 text-xs">')
  })

  it("gives each class the values its utilities gave", () => {
    // `bg-paper-2`, `has-[:checked]:bg-mark`, `has-[:checked]:text-mark-ink`
    expect(ruleBody(chips, ".gf-pill")).toMatch(
      /\{\s+background-color: var\(--color-paper-2\);\s+$/
    )
    expect(ruleBody(chips, ".gf-pill:has(:checked)")).toMatch(
      /background-color: var\(--color-mark\);\s+color: var\(--color-mark-ink\);/
    )
    // `bg-paper-2`; the current page's `bg-text text-paper`
    expect(ruleBody(chips, ".gf-page-link")).toMatch(
      /\{\s+background-color: var\(--color-paper-2\);\s+$/
    )
    expect(ruleBody(chips, '.gf-page-link[aria-current="page"]')).toMatch(
      /background-color: var\(--color-text\);\s+color: var\(--color-paper\);/
    )
    expect(ruleBody(chips, ".gf-fact")).toMatch(
      /\{\s+background-color: var\(--color-paper-2\);\s+$/
    )
    // `hover:bg-paper-3`, in a hover-capable pointer's media query, never over the chosen one
    const hover = chips.slice(chips.indexOf("@media (hover: hover)"))
    expect(hover).toMatch(
      /\.gf-pill:hover:not\(:has\(:checked\)\),\s+\.gf-page-link:hover:not\(\[aria-current="page"\]\) \{\s+background-color: var\(--color-paper-3\);/
    )
    // The theme's stylesheet takes the file in
    expect(atolyeCss("styles.css")).toContain('@import "./chips.css";')
  })
})

/** The stylesheet from the lined step on, comments out, whitespace folded. */
const lined = chips
  .slice(chips.indexOf("`chip_style: lined`"))
  .replace(/^[^]*?\*\//, "")
  .replace(/\/\*[^]*?\*\//g, "")
  .replace(/\s+/g, " ")
/** Each rule of the lined step: its selector and its declarations. */
const linedRules = [...lined.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector = "", body = ""]) => ({
    selector: selector.replace(/^.*?@(?:layer|media)[^{]*$/, "").trim(),
    body: body.trim(),
  }))
  .filter((rule) => rule.selector !== "")
const linedRule = (part: string) => {
  const found = linedRules.find((rule) => rule.selector.includes(part))
  if (!found) {
    throw new Error(`no lined rule for ${part}`)
  }
  return found
}
/** The chosen states every lined rule leaves out. */
const CHOSEN = ':not( [aria-selected="true"], [aria-current="page"], :has(:checked) )'

describe("the lined chip style (adr/0067 step 3b)", () => {
  it("draws only under the root element's mark: the default prints and reads nothing new", () => {
    expect(linedRules.length).toBeGreaterThanOrEqual(5)
    for (const rule of linedRules) {
      expect(rule.selector).toMatch(/^\[data-chip-style="lined"\] /)
    }
    // Before the step: the family's own rules name no mark
    const filled = chips.slice(0, chips.indexOf("`chip_style: lined`"))
    expect(filled).not.toContain("data-chip-style")
  })

  it("stands a resting chip, option pill and page number on the page's ground in a 1 px edge", () => {
    const rest = linedRule(":is(.gf-chip:not(.gf-box), .gf-pill, .gf-page-link)")
    expect(rest.selector).toContain(CHOSEN)
    expect(rest.body).toBe(
      "background-color: var(--color-paper); box-shadow: inset 0 0 0 1px var(--color-edge);"
    )
    // The shelf's tab the same, outside the layers like `tabs.css`
    const tab = linedRule(".gf-tab:not(")
    expect(tab.selector).toBe('[data-chip-style="lined"] .gf-tab:not(:has(> input:checked))')
    expect(tab.body).toBe(rest.body)
    // The live search's chip on its panel's field; a fact pill in a box's hairline
    expect(linedRule(".gf-option-chip").body).toBe("background-color: var(--color-field);")
    expect(linedRule(".gf-fact").body).toBe(
      "background-color: var(--color-paper); box-shadow: inset 0 0 0 1px var(--color-rule);"
    )
  })

  it("answers the pointer with the ink's edge on the next tint, never over the chosen one", () => {
    const hover = linedRule(":hover")
    expect(hover.selector).toBe(
      `[data-chip-style="lined"] :is(.gf-chip:not(.gf-box), .gf-pill, .gf-page-link, .gf-tab):hover${CHOSEN}`
    )
    expect(hover.body).toBe(
      "background-color: var(--color-paper-2); box-shadow: inset 0 0 0 1px var(--color-text);"
    )
    expect(lined).toMatch(/@media \(hover: hover\) \{ \[data-chip-style="lined"\] :is\(/)
  })

  it("keeps the chosen fill of both steps: no lined rule paints a chosen state or the mark", () => {
    // Grounds and edges only: no ink, no mark
    for (const rule of linedRules) {
      expect(rule.body).not.toMatch(/mark|(?:^|; )color: /)
    }
    // Every control's rule leaves the chosen states out (a fact is never chosen)
    for (const rule of linedRules.filter((each) => !each.selector.includes(".gf-fact"))) {
      expect(
        [CHOSEN, ':not([aria-selected="true"])', ":not(:has(> input:checked))"].some((left) =>
          rule.selector.includes(left)
        ),
        rule.selector
      ).toBe(true)
    }
    // The selected rules themselves are today's
    expect(ruleBody(atolyeCss("ui.css"), '.gf-chip[aria-current="page"]')).toMatch(
      /background: var\(--color-mark\);\s+color: var\(--color-mark-ink\);/
    )
    expect(ruleBody(atolyeCss("tabs.css"), ".gf-tab:has(> input:checked)")).toMatch(
      /background: var\(--color-mark\);\s+color: var\(--color-mark-ink\);/
    )
  })

  it("writes each lined rule in the layer of the rule it reads (adr/0067 Uygulama notu)", () => {
    // `.gf-chip` is in `components` (ui.css), `.gf-tab` outside the layers (tabs.css)
    expect(atolyeCss("ui.css")).toMatch(/@layer components \{[^]*\.gf-chip \{/)
    expect(atolyeCss("tabs.css")).not.toContain("@layer")
    const layered = lined.slice(lined.indexOf("@layer components {"))
    const layerEnd = layered.indexOf("} } ") + 3
    const inLayer = layered.slice(0, layerEnd)
    expect(inLayer).toContain(".gf-pill, .gf-page-link")
    expect(inLayer).toContain(".gf-option-chip")
    expect(inLayer).toContain(".gf-fact")
    expect(inLayer).not.toContain(".gf-tab")
    expect(layered.slice(layerEnd)).toMatch(/^ ?\[data-chip-style="lined"\] \.gf-tab:not/)
  })
})
