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
