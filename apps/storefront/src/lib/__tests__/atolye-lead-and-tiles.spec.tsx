import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
// The theme's own parts: it exports pages, not these
import { TileRail } from "../../../../../packages/themes/atolye/src/listing/CategoryTiles"

/**
 * Fifth Tezgâh audit: the "1 big + 6 small" shelf's large card keeps its
 * words and button together at the foot, its photo well taking the rest
 * (V-02); the subcategory tiles above a listing stand level, the name on
 * at most two lines (V-03).
 */

const THEME = new URL("../../../../../packages/themes/atolye/src/", import.meta.url)
const css = (name: string) => readFileSync(new URL(name, THEME), "utf8")

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`)
  if (at < 0) {
    throw new Error(`no rule for ${selector}`)
  }
  return sheet.slice(at, sheet.indexOf("}", at))
}

describe("the featured shelf's large card (V-02)", () => {
  const card = css("card.css")

  it("lets its photo well take the height the words and button leave", () => {
    expect(rule(card, ".gf-card-lead > .gf-card-framed .gf-card-media")).toMatch(/flex: 1 1/)
    expect(rule(card, ".gf-card-lead > .gf-card-framed .gf-card-media")).toContain(
      "aspect-ratio: auto"
    )
  })

  it("shows the photo whole and never past its own size", () => {
    const img = rule(card, ".gf-card-lead > .gf-card-framed .gf-card-media img")
    expect(img).toContain("object-fit: contain")
    expect(img).toContain("width: auto")
    expect(img).toContain("height: auto")
    expect(img).toContain("max-width: 100%")
    expect(img).toContain("max-height: 100%")
  })

  // Sixth audit V-05: a lone photo's <picture> is the well's direct child and
  // must stay absolute over it; a later, more specific rule naming a bare
  // `picture` outranked that, left it inline at 0 wide and drew the photo 0×0
  it("keeps a lone photo's picture absolute over the well", () => {
    const lead = card.slice(card.indexOf(".gf-card-lead {"))
    expect(
      rule(card, ".gf-card-lead > .gf-card-framed .gf-card-media > :is(picture, .gf-card-slides)")
    ).toMatch(/position: absolute;\s*inset: 0/)
    const relative = [...lead.matchAll(/([^{}]+)\{[^}]*position: relative/g)].map((m) =>
      (m[1] ?? "").replace(/\s+/g, " ")
    )
    expect(relative.length).toBeGreaterThan(0)
    for (const selector of relative) {
      // A `picture` it names sits inside a slide, never one standing alone in the list
      expect(selector).not.toMatch(/[(,]\s*picture\s*[,)]/)
    }
  })

  it("keeps the words from growing, so the button sits right under the price", () => {
    const info = rule(card, ".gf-card-lead > .gf-card-framed > .gf-card-info")
    expect(info).toContain("flex: none")
    expect(info).toContain("padding-bottom: 1.25rem")
  })
})

describe("the subcategory tiles above a listing (V-03)", () => {
  const categories = [
    { label: "Şef Bıçakları", path: "/kategori/sef", image: null },
    { label: "Soyma ve Sebze Bıçakları", path: "/kategori/soyma", image: null },
  ]
  const html = renderToStaticMarkup(
    <TileRail id="alt" title="Alt kategoriler" categories={categories} />
  )

  it("stretches every tile's cell to the row's height", () => {
    expect(html).toContain("items-stretch")
    expect(rule(css("surface.css"), '[data-surface="lined"] .gf-subtile')).toContain("height: 100%")
  })

  it("keeps each name to two lines", () => {
    expect(html.match(/line-clamp-2/g)).toHaveLength(2)
  })
})
